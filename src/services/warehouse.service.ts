import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import RedisService from './redis.service';
import { logActivity } from '@utils/logger';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  QueryWarehousesInput,
} from '@validators/warehouse.validator';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const WAREHOUSE_CACHE_TTL = 3600;
const WAREHOUSE_LIST_CACHE_TTL = 300;

class WarehouseService {
  async getAllWarehouses(query: QueryWarehousesInput) {
    const {
      page = '1',
      limit = '20',
      search,
      warehouseType,
      status,
      city,
      region,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Create a consistent cache key
    const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : 'default';
    const cacheKey = `warehouse:list:${queryString}`;

    console.log(`📦 Cache key: ${cacheKey}`);

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Cache MISS: ${cacheKey}, querying database...`);

    const where: Prisma.WarehouseWhereInput = {
      ...(search && {
        OR: [
          { warehouseName: { contains: search } },
          { warehouseCode: { contains: search } },
          { address: { contains: search } },
          { city: { contains: search } },
          { region: { contains: search } },
        ],
      }),
      ...(warehouseType && { warehouseType }),
      ...(status && { status }),
      ...(city && { city: { contains: city } }),
      ...(region && { region: { contains: region } }),
    };

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          warehouseCode: true,
          warehouseName: true,
          warehouseType: true,
          address: true,
          city: true,
          region: true,
          description: true,
          managerId: true,
          capacity: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          manager: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          _count: {
            select: {
              inventory: true,
              stockTransactions: true,
              purchaseOrders: true,
              salesOrders: true,
            },
          },
        },
      }),
      prisma.warehouse.count({ where }),
    ]);

    const result = {
      data: warehouses,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    await redis.set(cacheKey, result, WAREHOUSE_LIST_CACHE_TTL);

    return result;
  }

  async getWarehouseById(id: number) {
    const cacheKey = `warehouse:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      select: {
        id: true,
        warehouseCode: true,
        warehouseName: true,
        warehouseType: true,
        address: true,
        city: true,
        region: true,
        description: true,
        managerId: true,
        capacity: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        manager: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        users: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
            phone: true,
            role: {
              select: {
                id: true,
                roleName: true,
              },
            },
          },
        },
        _count: {
          select: {
            inventory: true,
            stockTransactions: true,
            purchaseOrders: true,
            salesOrders: true,
            productionOrders: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    await redis.set(cacheKey, warehouse, WAREHOUSE_CACHE_TTL);

    return warehouse;
  }

  async createWarehouse(data: CreateWarehouseInput, createdBy: number) {
    const codeExists = await this.checkWarehouseCodeExists(data.warehouseCode);
    if (codeExists) {
      throw new ConflictError('Warehouse code already exists');
    }

    if (data.managerId) {
      const managerExists = await prisma.user.findUnique({
        where: { id: data.managerId },
      });
      if (!managerExists) {
        throw new NotFoundError('Manager not found');
      }
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        warehouseCode: data.warehouseCode,
        warehouseName: data.warehouseName,
        warehouseType: data.warehouseType,
        address: data.address || null,
        city: data.city || null,
        region: data.region || null,
        description: data.description || null,
        managerId: data.managerId || null,
        capacity: data.capacity || null,
        status: data.status || 'active',
      },
      select: {
        id: true,
        warehouseCode: true,
        warehouseName: true,
        warehouseType: true,
        address: true,
        city: true,
        region: true,
        description: true,
        managerId: true,
        capacity: true,
        status: true,
        createdAt: true,
        manager: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    logActivity('create', createdBy, 'warehouses', {
      recordId: warehouse.id,
      newValue: warehouse,
    });

    await this.invalidateListCache();

    return warehouse;
  }

  async updateWarehouse(id: number, data: UpdateWarehouseInput, updatedBy: number) {
    const existingWarehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!existingWarehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    if (data.warehouseCode && data.warehouseCode !== existingWarehouse.warehouseCode) {
      const codeExists = await this.checkWarehouseCodeExists(data.warehouseCode, id);
      if (codeExists) {
        throw new ConflictError('Warehouse code already exists');
      }
    }

    if (data.managerId) {
      const managerExists = await prisma.user.findUnique({
        where: { id: data.managerId },
      });
      if (!managerExists) {
        throw new NotFoundError('Manager not found');
      }
    }

    const updatedWarehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.warehouseCode && { warehouseCode: data.warehouseCode }),
        ...(data.warehouseName && { warehouseName: data.warehouseName }),
        ...(data.warehouseType && { warehouseType: data.warehouseType }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.region !== undefined && { region: data.region }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.managerId !== undefined && { managerId: data.managerId }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.status && { status: data.status }),
      },
      select: {
        id: true,
        warehouseCode: true,
        warehouseName: true,
        warehouseType: true,
        address: true,
        city: true,
        region: true,
        description: true,
        managerId: true,
        capacity: true,
        status: true,
        updatedAt: true,
        manager: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    logActivity('update', updatedBy, 'warehouses', {
      recordId: id,
      oldValue: existingWarehouse,
      newValue: updatedWarehouse,
    });

    await redis.del(`warehouse:${id}`);
    await this.invalidateListCache();

    return updatedWarehouse;
  }

  async deleteWarehouse(id: number, deletedBy: number) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inventory: true,
            stockTransactions: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    if (warehouse._count.inventory > 0) {
      throw new ValidationError('Cannot delete warehouse with existing inventory');
    }

    if (warehouse._count.stockTransactions > 0) {
      throw new ValidationError('Cannot delete warehouse with existing transactions');
    }

    // Hard delete instead of soft delete
    await prisma.warehouse.delete({
      where: { id },
    });

    logActivity('delete', deletedBy, 'warehouses', {
      recordId: id,
      oldValue: warehouse,
    });

    await redis.del(`warehouse:${id}`);
    await this.invalidateListCache();

    return { message: 'Warehouse deleted successfully' };
  }

  async getWarehouseStatistics(id: number) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    const inventoryStats = await prisma.inventory.aggregate({
      where: { warehouseId: id },
      _count: { id: true },
      _sum: {
        quantity: true,
        reservedQuantity: true,
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactionStats = await prisma.stockTransaction.groupBy({
      by: ['transactionType'],
      where: {
        warehouseId: id,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: {
        id: true,
      },
    });

    const totalProducts = await prisma.inventory.count({
      where: { warehouseId: id },
    });

    const stats = {
      warehouseId: id,
      warehouseName: warehouse.warehouseName,
      warehouseType: warehouse.warehouseType,
      inventory: {
        totalProducts: inventoryStats._count.id || 0,
        totalQuantity: inventoryStats._sum.quantity || 0,
        reservedQuantity: inventoryStats._sum.reservedQuantity || 0,
        availableQuantity:
          Number(inventoryStats._sum?.quantity ?? 0) -
          Number(inventoryStats._sum?.reservedQuantity ?? 0),
      },
      transactions: {
        last30Days: transactionStats.reduce((acc, stat) => {
          acc[stat.transactionType] = stat._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
      capacity: {
        total: warehouse.capacity,
        used: totalProducts,
        available: warehouse.capacity ? Number(warehouse.capacity) - totalProducts : null,
        utilizationPercent: warehouse.capacity
          ? (totalProducts / Number(warehouse.capacity)) * 100
          : null,
      },
    };

    return stats;
  }

  async checkWarehouseCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        warehouseCode: code,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !!warehouse;
  }

  private async invalidateListCache() {
    try {
      // Get all warehouse list cache keys
      const pattern = 'warehouse:list:*';
      console.log(`🔍 Looking for keys matching pattern: ${pattern}`);

      const keys = await redis.keys(pattern);
      console.log(`📋 Found ${keys.length} keys:`, keys);

      if (keys.length === 0) {
        console.log('⚠️  No warehouse list cache keys found');
        return;
      }

      // Delete all found keys
      const deletedCount = await redis.del(keys);
      console.log(`✅ Successfully deleted ${deletedCount} warehouse list cache keys`);
    } catch (error) {
      console.error('❌ Error invalidating warehouse list cache:', error);
    }
  }
}

export default new WarehouseService();
