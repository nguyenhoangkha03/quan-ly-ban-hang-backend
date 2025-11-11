import { PrismaClient, Prisma, ProductType } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import RedisService, { CachePrefix } from './redis.service';
import { logActivity } from '@utils/logger';
import {
  CreateBomInput,
  UpdateBomInput,
  BomQueryInput,
  CalculateMaterialsInput,
} from '@validators/bom.validator';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const BOM_CACHE_TTL = 3600;

class BomService {
  async getAll(params: BomQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      finishedProductId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    const where: Prisma.BomWhereInput = {
      ...(status && { status }),
      ...(finishedProductId && { finishedProductId }),
      ...(search && {
        OR: [
          { bomCode: { contains: search } },
          { finishedProduct: { productName: { contains: search } } },
        ],
      }),
    };

    const [boms, total] = await Promise.all([
      prisma.bom.findMany({
        where,
        include: {
          finishedProduct: {
            select: {
              id: true,
              sku: true,
              productName: true,
              productType: true,
              unit: true,
            },
          },
          materials: {
            include: {
              material: {
                select: {
                  id: true,
                  sku: true,
                  productName: true,
                  productType: true,
                  unit: true,
                },
              },
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
          approver: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.bom.count({ where }),
    ]);

    return {
      data: boms,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: number) {
    const cacheKey = `${CachePrefix.PRODUCT}bom:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const bom = await prisma.bom.findUnique({
      where: { id },
      include: {
        finishedProduct: {
          select: {
            id: true,
            sku: true,
            productName: true,
            productType: true,
            unit: true,
            sellingPriceRetail: true,
          },
        },
        materials: {
          include: {
            material: {
              select: {
                id: true,
                sku: true,
                productName: true,
                productType: true,
                packagingType: true,
                unit: true,
                purchasePrice: true,
              },
            },
          },
          orderBy: {
            materialType: 'asc',
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            email: true,
          },
        },
        productionOrders: {
          select: {
            id: true,
            orderCode: true,
            status: true,
            plannedQuantity: true,
            actualQuantity: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('BOM not found');
    }

    await redis.set(cacheKey, bom, BOM_CACHE_TTL);

    return bom;
  }

  async create(data: CreateBomInput, userId: number) {
    const existingBom = await prisma.bom.findUnique({
      where: { bomCode: data.bomCode },
    });

    if (existingBom) {
      throw new ConflictError('BOM code already exists');
    }

    const finishedProduct = await prisma.product.findUnique({
      where: { id: data.finishedProductId },
    });

    if (!finishedProduct) {
      throw new NotFoundError('Finished product not found');
    }

    if (finishedProduct.productType !== ProductType.finished_product) {
      throw new ValidationError('Product must be of type finished_product');
    }

    if (finishedProduct.status !== 'active') {
      throw new ValidationError('Finished product must be active');
    }

    const materialIds = data.materials.map((m) => m.materialId);
    const materials = await prisma.product.findMany({
      where: { id: { in: materialIds } },
    });

    if (materials.length !== materialIds.length) {
      throw new NotFoundError('One or more materials not found');
    }

    for (const materialInput of data.materials) {
      const material = materials.find((m) => m.id === materialInput.materialId);
      if (!material) continue;

      if (
        materialInput.materialType === 'raw_material' &&
        material.productType !== ProductType.raw_material
      ) {
        throw new ValidationError(
          `Material "${material.productName}" must be of type raw_material`
        );
      }

      if (
        materialInput.materialType === 'packaging' &&
        material.productType !== ProductType.packaging
      ) {
        throw new ValidationError(`Material "${material.productName}" must be of type packaging`);
      }

      if (material.status !== 'active') {
        throw new ValidationError(`Material "${material.productName}" must be active`);
      }
    }

    const bom = await prisma.bom.create({
      data: {
        bomCode: data.bomCode,
        finishedProductId: data.finishedProductId,
        version: data.version || '1.0',
        outputQuantity: data.outputQuantity,
        efficiencyRate: data.efficiencyRate || 100,
        productionTime: data.productionTime,
        notes: data.notes,
        status: 'draft',
        createdBy: userId,
        materials: {
          create: data.materials.map((m) => ({
            materialId: m.materialId,
            quantity: m.quantity,
            unit: m.unit,
            materialType: m.materialType,
            notes: m.notes,
          })),
        },
      },
      include: {
        finishedProduct: true,
        materials: {
          include: {
            material: true,
          },
        },
      },
    });

    logActivity('create', userId, 'bom', {
      recordId: bom.id,
      bomCode: bom.bomCode,
    });

    return bom;
  }

  async update(id: number, data: UpdateBomInput, userId: number) {
    const bom = await prisma.bom.findUnique({
      where: { id },
      include: { materials: true },
    });

    if (!bom) {
      throw new NotFoundError('BOM not found');
    }

    if (bom.status === 'active') {
      throw new ValidationError('Cannot update active BOM. Create a new version instead.');
    }

    if (data.bomCode && data.bomCode !== bom.bomCode) {
      const existingBom = await prisma.bom.findUnique({
        where: { bomCode: data.bomCode },
      });

      if (existingBom) {
        throw new ConflictError('BOM code already exists');
      }
    }

    if (data.finishedProductId && data.finishedProductId !== bom.finishedProductId) {
      const finishedProduct = await prisma.product.findUnique({
        where: { id: data.finishedProductId },
      });

      if (!finishedProduct) {
        throw new NotFoundError('Finished product not found');
      }

      if (finishedProduct.productType !== ProductType.finished_product) {
        throw new ValidationError('Product must be of type finished_product');
      }
    }

    if (data.materials) {
      const materialIds = data.materials.map((m) => m.materialId);
      const materials = await prisma.product.findMany({
        where: { id: { in: materialIds } },
      });

      if (materials.length !== materialIds.length) {
        throw new NotFoundError('One or more materials not found');
      }

      for (const materialInput of data.materials) {
        const material = materials.find((m) => m.id === materialInput.materialId);
        if (!material) continue;

        if (
          materialInput.materialType === 'raw_material' &&
          material.productType !== ProductType.raw_material
        ) {
          throw new ValidationError(
            `Material "${material.productName}" must be of type raw_material`
          );
        }

        if (
          materialInput.materialType === 'packaging' &&
          material.productType !== ProductType.packaging
        ) {
          throw new ValidationError(`Material "${material.productName}" must be of type packaging`);
        }
      }
    }

    const updatedBom = await prisma.bom.update({
      where: { id },
      data: {
        ...(data.bomCode && { bomCode: data.bomCode }),
        ...(data.finishedProductId && { finishedProductId: data.finishedProductId }),
        ...(data.version && { version: data.version }),
        ...(data.outputQuantity && { outputQuantity: data.outputQuantity }),
        ...(data.efficiencyRate !== undefined && { efficiencyRate: data.efficiencyRate }),
        ...(data.productionTime !== undefined && { productionTime: data.productionTime }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.materials && {
          materials: {
            deleteMany: {},
            create: data.materials.map((m) => ({
              materialId: m.materialId,
              quantity: m.quantity,
              unit: m.unit,
              materialType: m.materialType,
              notes: m.notes,
            })),
          },
        }),
      },
      include: {
        finishedProduct: true,
        materials: {
          include: {
            material: true,
          },
        },
      },
    });

    await redis.del(`${CachePrefix.PRODUCT}bom:${id}`);

    logActivity('update', userId, 'bom', {
      recordId: id,
      bomCode: updatedBom.bomCode,
      changes: data,
    });

    return updatedBom;
  }

  async delete(id: number, userId: number) {
    const bom = await prisma.bom.findUnique({
      where: { id },
      include: {
        productionOrders: true,
      },
    });

    if (!bom) {
      throw new NotFoundError('BOM not found');
    }

    if (bom.productionOrders.length > 0) {
      throw new ValidationError(
        'Cannot delete BOM that has production orders. Set status to inactive instead.'
      );
    }

    if (bom.status === 'active') {
      throw new ValidationError('Cannot delete active BOM. Set status to inactive instead.');
    }

    await prisma.bom.delete({
      where: { id },
    });

    await redis.del(`${CachePrefix.PRODUCT}bom:${id}`);

    logActivity('delete', userId, 'bom', {
      recordId: id,
      bomCode: bom.bomCode,
    });

    return { message: 'BOM deleted successfully' };
  }

  async approve(id: number, userId: number, notes?: string) {
    const bom = await prisma.bom.findUnique({
      where: { id },
      include: {
        materials: true,
        finishedProduct: true,
      },
    });

    if (!bom) {
      throw new NotFoundError('BOM not found');
    }

    if (bom.status === 'active') {
      throw new ValidationError('BOM is already approved');
    }

    if (bom.materials.length === 0) {
      throw new ValidationError('Cannot approve BOM without materials');
    }

    const updatedBom = await prisma.bom.update({
      where: { id },
      data: {
        status: 'active',
        approvedBy: userId,
        approvedAt: new Date(),
        ...(notes && { notes }),
      },
      include: {
        finishedProduct: true,
        materials: {
          include: {
            material: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });

    await redis.del(`${CachePrefix.PRODUCT}bom:${id}`);

    logActivity('approve', userId, 'bom', {
      recordId: id,
      bomCode: bom.bomCode,
      notes,
    });

    return updatedBom;
  }

  async calculateMaterials(params: CalculateMaterialsInput) {
    const { bomId, productionQuantity } = params;

    const bom = await prisma.bom.findUnique({
      where: { id: bomId },
      include: {
        materials: {
          include: {
            material: {
              select: {
                id: true,
                sku: true,
                productName: true,
                productType: true,
                unit: true,
                purchasePrice: true,
              },
            },
          },
        },
        finishedProduct: {
          select: {
            id: true,
            productName: true,
            unit: true,
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('BOM not found');
    }

    const batchCount = productionQuantity / Number(bom.outputQuantity);

    const materialsNeeded = bom.materials.map((bomMaterial) => {
      const baseQuantity = Number(bomMaterial.quantity) * batchCount;

      const adjustedQuantity = baseQuantity * (100 / Number(bom.efficiencyRate));
      const estimatedCost = adjustedQuantity * (Number(bomMaterial.material.purchasePrice) || 0);

      return {
        materialId: bomMaterial.materialId,
        materialName: bomMaterial.material.productName,
        materialSku: bomMaterial.material.sku,
        materialType: bomMaterial.materialType,
        unit: bomMaterial.unit || bomMaterial.material.unit,
        baseQuantityPerBatch: Number(bomMaterial.quantity),
        totalQuantityNeeded: Math.ceil(adjustedQuantity * 100) / 100,
        unitPrice: Number(bomMaterial.material.purchasePrice) || 0,
        estimatedCost: Math.ceil(estimatedCost * 100) / 100,
      };
    });

    const totalCost = materialsNeeded.reduce((sum, m) => sum + m.estimatedCost, 0);

    return {
      bomId: bom.id,
      bomCode: bom.bomCode,
      finishedProduct: {
        id: bom.finishedProduct.id,
        name: bom.finishedProduct.productName,
        unit: bom.finishedProduct.unit,
      },
      productionQuantity,
      outputQuantityPerBatch: Number(bom.outputQuantity),
      batchCount: Math.ceil(batchCount * 100) / 100,
      efficiencyRate: Number(bom.efficiencyRate),
      materials: materialsNeeded,
      totalEstimatedCost: Math.ceil(totalCost * 100) / 100,
      costPerUnit:
        productionQuantity > 0 ? Math.ceil((totalCost / productionQuantity) * 100) / 100 : 0,
    };
  }

  async getByFinishedProduct(finishedProductId: number) {
    const boms = await prisma.bom.findMany({
      where: {
        finishedProductId,
        status: 'active',
      },
      include: {
        materials: {
          include: {
            material: {
              select: {
                id: true,
                sku: true,
                productName: true,
                productType: true,
                unit: true,
              },
            },
          },
        },
      },
      orderBy: {
        version: 'desc',
      },
    });

    return boms;
  }

  async setInactive(id: number, userId: number, reason?: string) {
    const bom = await prisma.bom.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('BOM not found');
    }

    const updatedBom = await prisma.bom.update({
      where: { id },
      data: {
        status: 'inactive',
        notes: reason ? `${bom.notes || ''}\n[Inactive] ${reason}` : bom.notes,
      },
    });

    await redis.del(`${CachePrefix.PRODUCT}bom:${id}`);

    logActivity('update', userId, 'bom', {
      recordId: id,
      action: 'set_inactive',
      reason,
    });

    return updatedBom;
  }
}

export default new BomService();
