import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import RedisService from './redis.service';
import { logActivity } from '@utils/logger';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  QuerySuppliersInput,
} from '@validators/supplier.validator';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const SUPPLIER_CACHE_TTL = 3600;
const SUPPLIER_LIST_CACHE_TTL = 600;

class SupplierService {
  async getAllSuppliers(query: QuerySuppliersInput) {
    const {
      page = '1',
      limit = '20',
      search,
      supplierType,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `supplier:list:${JSON.stringify(query)}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const where: Prisma.SupplierWhereInput = {
      ...(search && {
        OR: [
          { supplierName: { contains: search } },
          { supplierCode: { contains: search } },
          { contactName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { taxCode: { contains: search } },
        ],
      }),
      ...(supplierType && { supplierType }),
      ...(status && { status }),
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          supplierCode: true,
          supplierName: true,
          supplierType: true,
          contactName: true,
          phone: true,
          email: true,
          address: true,
          taxCode: true,
          totalPayable: true,
          paymentTerms: true,
          notes: true,
          status: true,
          createdBy: true,
          updatedBy: true,
          payableUpdatedAt: true,
          createdAt: true,
          updatedAt: true,
          creator: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
            },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    const result = {
      data: suppliers,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    await redis.set(cacheKey, result, SUPPLIER_LIST_CACHE_TTL);

    return result;
  }

  async getSupplierById(id: number) {
    const cacheKey = `supplier:${id}`;

    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        supplierType: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        taxCode: true,
        totalPayable: true,
        paymentTerms: true,
        notes: true,
        status: true,
        createdBy: true,
        updatedBy: true,
        payableUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
            paymentVouchers: true,
            debtReconciliations: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundError('Nhà cung cấp không tồn tại');
    }

    await redis.set(cacheKey, supplier, SUPPLIER_CACHE_TTL);

    return supplier;
  }

  async createSupplier(data: CreateSupplierInput, createdBy: number) {
    const codeExists = await this.checkSupplierCodeExists(data.supplierCode);
    if (codeExists) {
      throw new ConflictError('Mã nhà cung cấp đã tồn tại');
    }

    if (data.taxCode) {
      const taxCodeExists = await this.checkTaxCodeExists(data.taxCode);
      if (taxCodeExists) {
        throw new ConflictError('Mã số thuế đã tồn tại');
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        supplierCode: data.supplierCode,
        supplierName: data.supplierName,
        supplierType: data.supplierType || 'local',
        contactName: data.contactName || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        taxCode: data.taxCode || null,
        paymentTerms: data.paymentTerms || null,
        notes: data.notes || null,
        status: data.status || 'active',
        createdBy,
      },
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        supplierType: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        taxCode: true,
        paymentTerms: true,
        notes: true,
        status: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    logActivity('create', createdBy, 'suppliers', {
      recordId: supplier.id,
      newValue: supplier,
    });

    await this.invalidateListCache();

    return supplier;
  }

  async updateSupplier(id: number, data: UpdateSupplierInput, updatedBy: number) {
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      throw new NotFoundError('Nhà cung cấp không tồn tại');
    }

    if (data.supplierCode && data.supplierCode !== existingSupplier.supplierCode) {
      const codeExists = await this.checkSupplierCodeExists(data.supplierCode, id);
      if (codeExists) {
        throw new ConflictError('Mã nhà cung cấp đã tồn tại');
      }
    }

    if (data.taxCode && data.taxCode !== existingSupplier.taxCode) {
      const taxCodeExists = await this.checkTaxCodeExists(data.taxCode, id);
      if (taxCodeExists) {
        throw new ConflictError('Mã số thuế đã tồn tại');
      }
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(data.supplierCode && { supplierCode: data.supplierCode }),
        ...(data.supplierName && { supplierName: data.supplierName }),
        ...(data.supplierType && { supplierType: data.supplierType }),
        ...(data.contactName !== undefined && { contactName: data.contactName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.taxCode !== undefined && { taxCode: data.taxCode }),
        ...(data.paymentTerms !== undefined && { paymentTerms: data.paymentTerms }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status && { status: data.status }),
        updatedBy,
      },
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        supplierType: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        taxCode: true,
        paymentTerms: true,
        notes: true,
        status: true,
        updatedAt: true,
        updater: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    logActivity('update', updatedBy, 'suppliers', {
      recordId: id,
      oldValue: existingSupplier,
      newValue: updatedSupplier,
    });

    await redis.del(`supplier:${id}`);
    await this.invalidateListCache();

    return updatedSupplier;
  }

  async deleteSupplier(id: number, deletedBy: number) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundError('Nhà cung cấp không tồn tại');
    }

    if (supplier._count.products > 0) {
      throw new ValidationError('Không thể xóa nhà cung cấp có sản phẩm tồn tại');
    }

    if (supplier._count.purchaseOrders > 0) {
      throw new ValidationError('Không thể xóa nhà cung cấp có đơn hàng tồn tại');
    }

    await prisma.supplier.delete({
      where: { id },
    });

    logActivity('delete', deletedBy, 'suppliers', {
      recordId: id,
      oldValue: supplier,
    });

    await redis.del(`supplier:${id}`);
    await this.invalidateListCache();

    return { message: 'Xóa nhà cung cấp thành công' };
  }

  async getSupplierStatistics(id: number) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundError('Nhà cung cấp không tồn tại');
    }

    const purchaseOrderStats = await prisma.purchaseOrder.aggregate({
      where: { supplierId: id },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const productsCount = await prisma.product.count({
      where: { supplierId: id },
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentOrdersCount = await prisma.purchaseOrder.count({
      where: {
        supplierId: id,
        orderDate: {
          gte: sixMonthsAgo,
        },
      },
    });

    const stats = {
      supplierId: id,
      supplierName: supplier.supplierName,
      supplierType: supplier.supplierType,
      totalPurchaseOrders: purchaseOrderStats._count.id || 0,
      totalPurchaseAmount: purchaseOrderStats._sum.totalAmount || 0,
      productsSupplied: productsCount,
      recentOrders: {
        last6Months: recentOrdersCount,
      },
    };

    return stats;
  }

  async checkSupplierCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const supplier = await prisma.supplier.findFirst({
      where: {
        supplierCode: code,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !!supplier;
  }

  async checkTaxCodeExists(taxCode: string, excludeId?: number): Promise<boolean> {
    const supplier = await prisma.supplier.findFirst({
      where: {
        taxCode,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !!supplier;
  }

  private async invalidateListCache() {
    const keys = await redis.keys('supplier:list:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  }
}

export default new SupplierService();
