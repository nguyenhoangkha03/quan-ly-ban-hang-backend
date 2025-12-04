import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import RedisService, { CachePrefix } from './redis.service';
import { logActivity } from '@utils/logger';
import {
  type AlertInventoryQueryInput,
  type InventoryQueryInput,
} from '@validators/inventory.validator';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const INVENTORY_CACHE_TTL = parseInt(process.env.CACHE_TTL_INVENTORY || '300');

class InventoryService {
  async getAll(query: InventoryQueryInput) {
    const {
      page = '1',
      limit = '20',
      search,
      warehouseId,
      productId,
      productType,
      warehouseType,
      categoryId,
      lowStock,
      outOfStock,
      sortBy = 'productId',
      sortOrder = 'asc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Tạo khóa cache cho nhất quán
    const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : 'default';
    const cacheKey = `inventory:list:${queryString}`;

    const cache = await redis.get(cacheKey);
    if (cache) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cache;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const where: Prisma.InventoryWhereInput = {
      ...(search && {
        OR: [
          { product: { productName: { contains: search } } },
          { product: { sku: { contains: search } } },
          { warehouse: { warehouseName: { contains: search } } },
        ],
      }),
      ...(warehouseId && { warehouseId: Number(warehouseId) }),
      ...(productId && { productId: Number(productId) }),
      ...(productType && {
        product: {
          productType: productType as any,
        },
      }),
      ...(warehouseType && {
        warehouse: {
          warehouseType: warehouseType as any,
        },
      }),
      ...(categoryId && {
        product: {
          categoryId: Number(categoryId),
        },
      }),
    };

    let [inventories, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          quantity: true,
          reservedQuantity: true,
          warehouseId: true,
          productId: true,
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
              sellingPriceRetail: true,
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
      }),
      prisma.inventory.count({ where }),
    ]);

    if (Boolean(lowStock)) {
      inventories = inventories.filter(
        (inv) =>
          Number(inv.quantity) - Number(inv.reservedQuantity) < Number(inv.product.minStockLevel)
      );
      total = inventories.length;
    }

    if (Boolean(outOfStock)) {
      inventories = inventories.filter(
        (inv) => Number(inv.quantity) - Number(inv.reservedQuantity) <= 0
      );
      total = inventories.length;
    }

    const inventoryWithCalc = inventories.map((inv) => ({
      ...inv,
      availableQuantity: Number(inv.quantity) - Number(inv.reservedQuantity),
    }));

    const result = {
      data: inventoryWithCalc,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'Success',
    };

    await redis.set(cacheKey, result, INVENTORY_CACHE_TTL);

    return result;
  }

  async getAlerts(query: AlertInventoryQueryInput) {
    const { page = '1', limit = '20', search, warehouseId } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Tạo khóa cache cho nhất quán
    const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : 'default';
    const cacheKey = `alertInventory:list:${queryString}`;

    const cache = await redis.get(cacheKey);
    if (cache) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cache;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const where: Prisma.InventoryWhereInput = {
      ...(search && {
        OR: [
          { product: { productName: { contains: search } } },
          { product: { sku: { contains: search } } },
          { warehouse: { warehouseName: { contains: search } } },
        ],
      }),
      ...(warehouseId && { warehouseId: Number(warehouseId) }),
      product: {
        minStockLevel: { gt: 0 },
        status: 'active',
      },
    };

    const includeConfig = {
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
    };

    const allInventories = await prisma.inventory.findMany({
      where,
      include: includeConfig,
    });

    const allAlerts = allInventories
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

    const summary = {
      totalAlerts: allAlerts.length,
      outOfStock: allAlerts.filter((a) => a.availableQuantity === 0).length,
      critical: allAlerts.filter((a) => a.availableQuantity > 0 && a.percentageOfMin < 25).length,
      warning: allAlerts.filter((a) => a.percentageOfMin >= 25 && a.percentageOfMin < 50).length,
      low: allAlerts.filter((a) => a.percentageOfMin >= 50 && a.percentageOfMin < 100).length,
    };

    const paginatedAlerts = allAlerts.slice(skip, skip + limitNum);

    const result = {
      data: {
        alerts: paginatedAlerts,
        summary,
      },
      meta: {
        page: pageNum,
        limit: limitNum,
        total: allAlerts.length,
        totalPages: Math.ceil(allAlerts.length / limitNum),
      },
      message: 'Success',
    };

    await redis.set(cacheKey, result, INVENTORY_CACHE_TTL);

    return result;
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
            purchasePrice: true,
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

  async getStats(filters?: { warehouseType?: string }) {
    const where: Prisma.InventoryWhereInput = {
      ...(filters?.warehouseType && {
        warehouse: {
          warehouseType: filters.warehouseType as any,
        },
      }),
    };

    const allInventory = await prisma.inventory.findMany({
      where,
      include: {
        product: {
          select: {
            minStockLevel: true,
            sellingPriceRetail: true,
          },
        },
      },
    });

    const totalItems = allInventory.length;

    const totalValue = allInventory.reduce((sum, item) => {
      const value = Number(item.quantity) * Number(item.product?.sellingPriceRetail || 0);
      return sum + value;
    }, 0);

    const lowStockItems = allInventory.filter((item) => {
      const available = Number(item.quantity) - Number(item.reservedQuantity);
      const minLevel = Number(item.product?.minStockLevel || 0);
      return available < minLevel;
    }).length;

    const outOfStockItems = allInventory.filter((item) => {
      const available = Number(item.quantity) - Number(item.reservedQuantity);
      return available === 0;
    }).length;

    return {
      totalItems,
      totalValue,
      lowStockItems,
      outOfStockItems,
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
