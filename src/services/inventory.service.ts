import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import RedisService, { CachePrefix } from './redis.service';
import { logActivity } from '@utils/logger';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const INVENTORY_CACHE_TTL = parseInt(process.env.CACHE_TTL_INVENTORY || '300');

class InventoryService {

  // Lấy danh sách tồn kho với các bộ lọc tùy chọn
  async getAll(params: {
    warehouseId?: number;
    productId?: number;
    productType?: string;
    categoryId?: number;
    lowStock?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      warehouseId,
      productId,
      productType,
      categoryId,
      lowStock,
      sortBy = 'productId',
      sortOrder = 'asc',
    } = params;

    const where: Prisma.InventoryWhereInput = {
      ...(warehouseId && { warehouseId }),
      ...(productId && { productId }),
      ...(productType && {
        product: {
          productType: productType as any,
        },
      }),
      ...(categoryId && {
        product: {
          categoryId,
        },
      }),
    };

    let inventory = await prisma.inventory.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseCode: true,
            warehouseType: true,
          },
        },
        product: {
          select: {
            id: true,
            sku: true,
            productName: true,
            productType: true,
            unit: true,
            minStockLevel: true,
            status: true,
            category: {
              select: {
                id: true,
                categoryName: true,
                categoryCode: true,
              },
            },
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
    });

    const inventoryWithCalc = inventory.map((inv) => ({
      ...inv,
      availableQuantity: Number(inv.quantity) - Number(inv.reservedQuantity),
    }));

    if (lowStock) {
      return inventoryWithCalc.filter(
        (inv) => inv.availableQuantity < Number(inv.product.minStockLevel)
      );
    }

    return inventoryWithCalc;
  }

  async getByWarehouse(warehouseId: number) {
    const cacheKey = `${CachePrefix.INVENTORY}warehouse:${warehouseId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundError('Warehouse');
    }

    // Lấy toàn bộ inventory cho warehouse
    const inventory = await prisma.inventory.findMany({
      where: { warehouseId },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            productName: true,
            productType: true,
            packagingType: true,
            unit: true,
            minStockLevel: true,
            status: true,
            category: {
              select: {
                id: true,
                categoryName: true,
              },
            },
            images: {
              where: { isPrimary: true },
              select: {
                imageUrl: true,
                altText: true,
              },
            },
          },
        },
      },
      orderBy: { productId: 'asc' },
    });

    const result = inventory.map((inv) => ({
      ...inv,
      availableQuantity: Number(inv.quantity) - Number(inv.reservedQuantity),
    }));

    await redis.set(cacheKey, result, INVENTORY_CACHE_TTL);

    return result;
  }


  // Lấy tồn kho theo sản phẩm (trên tất cả kho)
  async getByProduct(productId: number) {
    const cacheKey = `${CachePrefix.INVENTORY}product:${productId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundError('Product');
    }

    const inventory = await prisma.inventory.findMany({
      where: { productId },
      include: {
        warehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseCode: true,
            warehouseType: true,
            city: true,
            region: true,
            status: true,
          },
        },
      },
      orderBy: { warehouseId: 'asc' },
    });

    const totalQuantity = inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
    const totalReserved = inventory.reduce((sum, inv) => sum + Number(inv.reservedQuantity), 0);
    const totalAvailable = totalQuantity - totalReserved;

    const result = {
      product: {
        id: product.id,
        sku: product.sku,
        productName: product.productName,
        productType: product.productType,
        unit: product.unit,
        minStockLevel: product.minStockLevel,
      },
      warehouses: inventory.map((inv) => ({
        ...inv,
        availableQuantity: Number(inv.quantity) - Number(inv.reservedQuantity),
      })),
      summary: {
        totalQuantity,
        totalReserved,
        totalAvailable,
        warehouseCount: inventory.length,
      },
    };

    await redis.set(cacheKey, result, INVENTORY_CACHE_TTL);

    return result;
  }

  async checkAvailability(
    items: Array<{
      productId: number;
      warehouseId: number;
      quantity: number;
    }>
  ) {
    const results = [];

    for (const item of items) {
      const inventory = await prisma.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: item.warehouseId,
            productId: item.productId,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              productName: true,
              unit: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              warehouseName: true,
              warehouseCode: true,
            },
          },
        },
      });

      if (!inventory) {
        results.push({
          productId: item.productId,
          warehouseId: item.warehouseId,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          isAvailable: false,
          message: 'Product not found in warehouse',
        });
        continue;
      }

      const availableQty = Number(inventory.quantity) - Number(inventory.reservedQuantity);

      results.push({
        productId: item.productId,
        warehouseId: item.warehouseId,
        product: inventory.product,
        warehouse: inventory.warehouse,
        requestedQuantity: item.quantity,
        currentQuantity: Number(inventory.quantity),
        reservedQuantity: Number(inventory.reservedQuantity),
        availableQuantity: availableQty,
        isAvailable: availableQty >= item.quantity,
        shortfall: Math.max(0, item.quantity - availableQty),
        message:
          availableQty >= item.quantity
            ? 'Available'
            : `Insufficient stock. Need ${item.quantity - availableQty} more`,
      });
    }

    const allAvailable = results.every((r) => r.isAvailable);

    return {
      allAvailable,
      items: results,
      summary: {
        totalItems: results.length,
        availableItems: results.filter((r) => r.isAvailable).length,
        unavailableItems: results.filter((r) => !r.isAvailable).length,
      },
    };
  }

  async update(
    data: {
      warehouseId: number;
      productId: number;
      quantity: number;
      reservedQuantity?: number;
      reason: string;
    },
    userId: number
  ) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundError('Warehouse');
    }

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) {
      throw new NotFoundError('Product');
    }

    const existing = await prisma.inventory.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: data.warehouseId,
          productId: data.productId,
        },
      },
    });

    const inventory = await prisma.inventory.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: data.warehouseId,
          productId: data.productId,
        },
      },
      create: {
        warehouseId: data.warehouseId,
        productId: data.productId,
        quantity: data.quantity,
        reservedQuantity: data.reservedQuantity || 0,
        updatedBy: userId,
      },
      update: {
        quantity: data.quantity,
        ...(data.reservedQuantity !== undefined && { reservedQuantity: data.reservedQuantity }),
        updatedBy: userId,
      },
      include: {
        warehouse: true,
        product: true,
      },
    });

    logActivity('update', userId, 'inventory', {
      recordId: inventory.id,
      oldValue: existing,
      newValue: inventory,
      reason: data.reason,
    });

    await this.invalidateCache(data.warehouseId, data.productId);

    return {
      ...inventory,
      availableQuantity: Number(inventory.quantity) - Number(inventory.reservedQuantity),
    };
  }

  async adjust(
    data: {
      warehouseId: number;
      productId: number;
      adjustment: number;
      reason: string;
    },
    userId: number
  ) {
    const current = await prisma.inventory.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: data.warehouseId,
          productId: data.productId,
        },
      },
    });

    if (!current) {
      throw new NotFoundError('Inventory record');
    }

    const newQuantity = Number(current.quantity) + data.adjustment;

    if (newQuantity < 0) {
      throw new ValidationError('Adjustment would result in negative inventory');
    }

    return this.update(
      {
        warehouseId: data.warehouseId,
        productId: data.productId,
        quantity: newQuantity,
        reason: data.reason,
      },
      userId
    );
  }

  async reserve(
    items: Array<{
      productId: number;
      warehouseId: number;
      quantity: number;
    }>,
    referenceType: string,
    referenceId: number,
    userId: number
  ) {
    const availabilityCheck = await this.checkAvailability(items);
    if (!availabilityCheck.allAvailable) {
      throw new ValidationError('Insufficient inventory', {
        unavailableItems: availabilityCheck.items.filter((i) => !i.isAvailable),
      });
    }

    const reserved = [];
    for (const item of items) {
      const current = await prisma.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: item.warehouseId,
            productId: item.productId,
          },
        },
      });

      if (!current) {
        throw new NotFoundError('Inventory record');
      }

      const newReserved = Number(current.reservedQuantity) + item.quantity;

      const updated = await prisma.inventory.update({
        where: {
          warehouseId_productId: {
            warehouseId: item.warehouseId,
            productId: item.productId,
          },
        },
        data: {
          reservedQuantity: newReserved,
          updatedBy: userId,
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              productName: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              warehouseName: true,
            },
          },
        },
      });

      reserved.push({
        ...updated,
        reservedAmount: item.quantity,
        availableQuantity: Number(updated.quantity) - Number(updated.reservedQuantity),
      });

      await this.invalidateCache(item.warehouseId, item.productId);
    }

    logActivity('update', userId, 'inventory', {
      action: 'reserve',
      referenceType,
      referenceId,
      items: reserved,
    });

    return {
      message: 'Inventory reserved successfully',
      items: reserved,
    };
  }

  async releaseReserved(
    items: Array<{
      productId: number;
      warehouseId: number;
      quantity: number;
    }>,
    referenceType: string,
    referenceId: number,
    userId: number
  ) {
    const released = [];

    for (const item of items) {
      const current = await prisma.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: item.warehouseId,
            productId: item.productId,
          },
        },
      });

      if (!current) {
        throw new NotFoundError('Inventory record');
      }

      const newReserved = Math.max(0, Number(current.reservedQuantity) - item.quantity);

      const updated = await prisma.inventory.update({
        where: {
          warehouseId_productId: {
            warehouseId: item.warehouseId,
            productId: item.productId,
          },
        },
        data: {
          reservedQuantity: newReserved,
          updatedBy: userId,
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              productName: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              warehouseName: true,
            },
          },
        },
      });

      released.push({
        ...updated,
        releasedAmount: item.quantity,
        availableQuantity: Number(updated.quantity) - Number(updated.reservedQuantity),
      });

      await this.invalidateCache(item.warehouseId, item.productId);
    }

    logActivity('update', userId, 'inventory', {
      action: 'release_reserved',
      referenceType,
      referenceId,
      items: released,
    });

    return {
      message: 'Reserved inventory released successfully',
      items: released,
    };
  }

  async getAlerts(warehouseId?: number) {
    const where: Prisma.InventoryWhereInput = {
      ...(warehouseId && { warehouseId }),
      product: {
        minStockLevel: { gt: 0 },
        status: 'active',
      },
    };

    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseCode: true,
            warehouseType: true,
          },
        },
        product: {
          select: {
            id: true,
            sku: true,
            productName: true,
            productType: true,
            unit: true,
            minStockLevel: true,
            category: {
              select: {
                id: true,
                categoryName: true,
              },
            },
          },
        },
      },
    });

    const alerts = inventory
      .map((inv) => {
        const availableQty = Number(inv.quantity) - Number(inv.reservedQuantity);
        const minLevel = Number(inv.product.minStockLevel);

        return {
          ...inv,
          availableQuantity: availableQty,
          shortfall: minLevel - availableQty,
          percentageOfMin: minLevel > 0 ? (availableQty / minLevel) * 100 : 0,
        };
      })
      .filter((inv) => inv.availableQuantity < Number(inv.product.minStockLevel))
      .sort((a, b) => a.percentageOfMin - b.percentageOfMin);

    return {
      alerts,
      summary: {
        totalAlerts: alerts.length,
        critical: alerts.filter((a) => a.percentageOfMin < 25).length,
        warning: alerts.filter((a) => a.percentageOfMin >= 25 && a.percentageOfMin < 50).length,
        low: alerts.filter((a) => a.percentageOfMin >= 50).length,
      },
    };
  }

  async getValueReport(warehouseId?: number) {
    const where: Prisma.InventoryWhereInput = {
      ...(warehouseId && { warehouseId }),
      quantity: { gt: 0 },
    };

    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseCode: true,
            warehouseType: true,
          },
        },
        product: {
          select: {
            id: true,
            sku: true,
            productName: true,
            productType: true,
            unit: true,
            purchasePrice: true,
            sellingPriceRetail: true,
          },
        },
      },
    });

    const report = inventory.map((inv) => {
      const qty = Number(inv.quantity);
      const purchasePrice = Number(inv.product.purchasePrice || 0);
      const sellingPrice = Number(inv.product.sellingPriceRetail || 0);

      return {
        ...inv,
        quantity: qty,
        purchaseValue: qty * purchasePrice,
        potentialValue: qty * sellingPrice,
        potentialProfit: qty * (sellingPrice - purchasePrice),
      };
    });

    const totalPurchaseValue = report.reduce((sum, item) => sum + item.purchaseValue, 0);
    const totalPotentialValue = report.reduce((sum, item) => sum + item.potentialValue, 0);
    const totalPotentialProfit = report.reduce((sum, item) => sum + item.potentialProfit, 0);

    const byProductType = report.reduce((acc, item) => {
      const type = item.product.productType;
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          purchaseValue: 0,
          potentialValue: 0,
        };
      }
      acc[type].count++;
      acc[type].purchaseValue += item.purchaseValue;
      acc[type].potentialValue += item.potentialValue;
      return acc;
    }, {} as Record<string, any>);

    return {
      items: report,
      summary: {
        totalItems: report.length,
        totalPurchaseValue,
        totalPotentialValue,
        totalPotentialProfit,
        profitMargin:
          totalPurchaseValue > 0
            ? ((totalPotentialProfit / totalPurchaseValue) * 100).toFixed(2) + '%'
            : '0%',
      },
      byProductType,
    };
  }

  private async invalidateCache(warehouseId?: number, productId?: number) {
    if (warehouseId) {
      await redis.del(`${CachePrefix.INVENTORY}warehouse:${warehouseId}`);
    }
    if (productId) {
      await redis.del(`${CachePrefix.INVENTORY}product:${productId}`);
    }
    await redis.flushPattern(`${CachePrefix.DASHBOARD}*`);
  }
}

export default new InventoryService();
