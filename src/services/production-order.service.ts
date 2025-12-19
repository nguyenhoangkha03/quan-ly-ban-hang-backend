import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import bomService from './bom.service';
import {
  CreateProductionOrderInput,
  UpdateProductionOrderInput,
  StartProductionInput,
  CompleteProductionInput,
  CancelProductionInput,
  ProductionOrderQueryInput,
} from '@validators/production-order.validator';
import RedisService from './redis.service';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const PRODUCTION_ORDER_CACHE_TTL = 3600;
const PRODUCTION_ORDER_LIST_CACHE_TTL = 300;

class ProductionOrderService {
  private async generateOrderCode(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await prisma.productionOrder.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    return `LSX-${dateStr}-${sequence}`;
  }

  async getAll(query: ProductionOrderQueryInput) {
    const {
      page = '1',
      limit = '20',
      search,
      status,
      bomId,
      warehouseId,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Tạo khóa cache cho nhất quán
    const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : 'default';
    const cacheKey = `production-order:list:${queryString}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const where: Prisma.ProductionOrderWhereInput = {
      ...(status && { status }),
      ...(bomId && { bomId }),
      ...(warehouseId && { warehouseId }),
      ...(search && {
        OR: [
          { orderCode: { contains: search } },
          { finishedProduct: { productName: { contains: search } } },
        ],
      }),
      ...(fromDate &&
        toDate && {
          startDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const [orders, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        include: {
          bom: {
            select: {
              id: true,
              bomCode: true,
              version: true,
              outputQuantity: true,
            },
          },
          finishedProduct: {
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
          materials: {
            include: {
              material: {
                select: {
                  id: true,
                  productName: true,
                  unit: true,
                  inventory: {
                    select: {
                      warehouseId: true,
                      quantity: true,
                      reservedQuantity: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              materials: true,
            },
          },
        },
      }),
      prisma.productionOrder.count({ where }),
    ]);

    const enrichedOrders = orders.map((order) => {
      if (order.status !== 'pending') {
        const { materials, ...orderWithoutMaterials } = order;
        return {
          ...orderWithoutMaterials,
          materialAvailability: null,
        };
      }

      const missingItems: any[] = [];
      let isSufficient = true;

      for (const item of order.materials) {
        const requiredQty = Number(item.plannedQuantity);

        const totalAvailable = item.material.inventory.reduce((sum, inv) => {
          const availalble = Number(inv.quantity) - Number(inv.reservedQuantity);

          return sum + (availalble > 0 ? availalble : 0);
        }, 0);

        if (totalAvailable < requiredQty) {
          isSufficient = false;
          missingItems.push({
            materialId: item.materialId,
            materialName: item.material.productName,
            unit: item.material.unit,
            required: requiredQty,
            available: totalAvailable,
            missing: requiredQty - totalAvailable,
          });
        }
      }

      const { materials, ...orderRest } = order;

      return {
        ...orderRest,
        materialAvailability: {
          status: isSufficient ? 'sufficient' : 'insufficient',
          missingItems: missingItems,
        },
      };
    });

    const result = {
      data: enrichedOrders,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'Lấy danh sách lệnh sản xuất thành công',
    };

    await redis.set(cacheKey, result, PRODUCTION_ORDER_LIST_CACHE_TTL);

    return result;
  }

  async getById(id: number) {
    const cacheKey = `production-order:${id}`;

    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        bom: {
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
          },
        },
        finishedProduct: {
          select: {
            id: true,
            sku: true,
            productName: true,
            productType: true,
            unit: true,
          },
        },
        warehouse: true,
        materials: {
          include: {
            material: {
              select: {
                id: true,
                sku: true,
                productName: true,
                productType: true,
                unit: true,
                inventory: {
                  select: {
                    warehouseId: true,
                    quantity: true,
                    reservedQuantity: true,
                  },
                },
              },
            },
            stockTransaction: {
              select: {
                id: true,
                transactionCode: true,
                status: true,
              },
            },
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
        canceller: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Không tìm thấy lệnh sản xuất');
    }

    // Calculate material shortages for pending orders
    let shortages: any[] = [];
    if (order.status === 'pending') {
      for (const item of order.materials) {
        const requiredQty = Number(item.plannedQuantity);

        const totalAvailable = item.material.inventory.reduce((sum: number, inv: any) => {
          const available = Number(inv.quantity) - Number(inv.reservedQuantity);
          return sum + (available > 0 ? available : 0);
        }, 0);

        if (totalAvailable < requiredQty) {
          shortages.push({
            materialId: item.materialId,
            materialName: item.material.productName,
            materialType: item.materialType,
            required: requiredQty,
            available: totalAvailable,
            shortage: requiredQty - totalAvailable,
            unit: item.material.unit,
          });
        }
      }
    }

    // Build response with shortages
    const responseData = {
      ...order,
      shortages,
    };

    await redis.set(cacheKey, responseData, PRODUCTION_ORDER_CACHE_TTL);

    return responseData;
  }

  async create(data: CreateProductionOrderInput, userId: number) {
    const bom = await bomService.getById(data.bomId);
    if (!bom) {
      throw new NotFoundError('Không tìm thấy BOM');
    }

    if (bom.status !== 'active') {
      throw new ValidationError('BOM phải là trạng thái active để tạo đơn sản xuất');
    }

    if (data.warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: data.warehouseId },
      });

      if (!warehouse) {
        throw new NotFoundError('Không tìm thấy kho');
      }

      if (warehouse.status !== 'active') {
        throw new ValidationError('Kho phải là trạng thái active để tạo đơn sản xuất');
      }

      if (warehouse.warehouseType !== 'finished_product') {
        throw new ValidationError('Kho không phù hợp. Vui lòng chọn kho thành phẩm.');
      }
    }

    const materialCalculation = await bomService.calculateMaterials({
      bomId: data.bomId,
      productionQuantity: data.plannedQuantity,
    });

    const orderCode = await this.generateOrderCode();

    const productionOrder = await prisma.productionOrder.create({
      data: {
        orderCode,
        bomId: data.bomId,
        finishedProductId: bom.finishedProductId,
        warehouseId: data.warehouseId,
        plannedQuantity: data.plannedQuantity,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        notes: data.notes,
        status: 'pending',
        createdBy: userId,
        materials: {
          create: materialCalculation.data.materials.map((mat) => ({
            materialId: mat.materialId,
            plannedQuantity: mat.totalQuantityNeeded,
            unitPrice: mat.unitPrice,
            materialType: mat.materialType,
            notes: mat.notes,
          })),
        },
      },
      include: {
        bom: true,
        finishedProduct: true,
        warehouse: true,
        materials: {
          include: {
            material: true,
          },
        },
      },
    });

    await redis.flushPattern('production-order:list:*');

    logActivity('create', userId, 'production_orders', {
      recordId: productionOrder.id,
      orderCode: productionOrder.orderCode,
    });

    return productionOrder;
  }

  async update(id: number, data: UpdateProductionOrderInput, userId: number) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Lệnh sản xuất không tồn tại');
    }

    if (order.status !== 'pending') {
      throw new ValidationError('Chỉ có thể cập nhật lệnh sản xuất ở trạng thái pending');
    }

    const updatedOrder = await prisma.productionOrder.update({
      where: { id },
      data: {
        ...(data.plannedQuantity && { plannedQuantity: data.plannedQuantity }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        bom: true,
        finishedProduct: true,
        warehouse: true,
        materials: {
          include: {
            material: true,
          },
        },
      },
    });

    logActivity('update', userId, 'production_orders', {
      recordId: id,
      orderCode: order.orderCode,
      changes: data,
    });

    return updatedOrder;
  }

  async start(id: number, userId: number, data?: StartProductionInput) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        materials: {
          include: {
            material: true,
          },
        },
        bom: true,
        warehouse: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Lệnh sản xuất không tồn tại');
    }

    if (order.status !== 'pending') {
      throw new ValidationError('Chỉ có thể bắt đầu lệnh sản xuất ở trạng thái pending');
    }

    const materialShortages: Array<{
      materialName: string;
      required: number;
      available: number;
    }> = [];

    for (const material of order.materials) {
      const warehouseType = material.materialType === 'raw_material' ? 'raw_material' : 'packaging';

      const inventoryRecords = await prisma.inventory.findMany({
        where: {
          productId: material.materialId,
          warehouse: {
            warehouseType,
            status: 'active',
          },
        },
      });

      const totalAvailable = inventoryRecords.reduce(
        (sum, inv) => sum + (Number(inv.quantity) - Number(inv.reservedQuantity)),
        0
      );

      if (totalAvailable < Number(material.plannedQuantity)) {
        materialShortages.push({
          materialName: material.material.productName,
          required: Number(material.plannedQuantity),
          available: totalAvailable,
        });
      }
    }

    if (materialShortages.length > 0) {
      throw new ValidationError('Không đủ nguyên vật liệu để bắt đầu sản xuất', materialShortages);
    }

    const stockTransactionCode = `PXK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${
      Date.now() % 1000
    }`;

    const result = await prisma.$transaction(async (tx) => {
      const stockTransaction = await tx.stockTransaction.create({
        data: {
          transactionCode: stockTransactionCode,
          transactionType: 'export',
          warehouseId: order.materials[0]?.material.productType === 'raw_material' ? 1 : 2, // TODO: Dynamic warehouse selection
          referenceType: 'production_order',
          referenceId: id,
          reason: `Export materials for production order ${order.orderCode}`,
          status: 'approved',
          createdBy: userId,
          approvedBy: userId,
          approvedAt: new Date(),
          details: {
            create: order.materials.map((mat) => ({
              productId: mat.materialId,
              quantity: mat.plannedQuantity,
              unitPrice: mat.unitPrice,
            })),
          },
        },
      });

      for (const material of order.materials) {
        const warehouseType =
          material.materialType === 'raw_material' ? 'raw_material' : 'packaging';

        const inventoryRecord = await tx.inventory.findFirst({
          where: {
            productId: material.materialId,
            warehouse: {
              warehouseType,
              status: 'active',
            },
            quantity: {
              gte: material.plannedQuantity,
            },
          },
          include: {
            warehouse: true,
          },
        });

        if (inventoryRecord) {
          await tx.inventory.update({
            where: { id: inventoryRecord.id },
            data: {
              quantity: {
                decrement: material.plannedQuantity,
              },
              updatedBy: userId,
            },
          });

          await tx.productionOrderMaterial.update({
            where: { id: material.id },
            data: {
              actualQuantity: material.plannedQuantity,
              stockTransactionId: stockTransaction.id,
            },
          });
        }
      }

      const updatedOrder = await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'in_progress',
          approvedBy: userId,
          approvedAt: new Date(),
          notes: data?.notes ? `${order.notes || ''}\n${data.notes}` : order.notes,
        },
        include: {
          bom: true,
          finishedProduct: true,
          warehouse: true,
          materials: {
            include: {
              material: true,
              stockTransaction: true,
            },
          },
        },
      });

      return { order: updatedOrder, stockTransaction };
    });

    logActivity('update', userId, 'production_orders', {
      recordId: id,
      action: 'start_production',
      orderCode: order.orderCode,
    });

    return result;
  }

  async complete(id: number, userId: number, data: CompleteProductionInput) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        materials: {
          include: {
            material: true,
          },
        },
        finishedProduct: true,
        warehouse: true,
        bom: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Production order not found');
    }

    if (order.status !== 'in_progress') {
      throw new ValidationError('Can only complete production orders with in_progress status');
    }

    if (!order.warehouseId) {
      throw new ValidationError('Warehouse must be specified to complete production order');
    }

    let totalWastage = 0;
    if (data.materials) {
      for (const materialInput of data.materials) {
        const plannedMaterial = order.materials.find(
          (m) => m.materialId === materialInput.materialId
        );
        if (plannedMaterial) {
          const wastage =
            materialInput.wastage !== undefined
              ? materialInput.wastage
              : materialInput.actualQuantity - Number(plannedMaterial.plannedQuantity);
          totalWastage += wastage;
        }
      }
    }

    const stockTransactionCode = `PNK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${
      Date.now() % 1000
    }`;

    const result = await prisma.$transaction(async (tx) => {
      const stockTransaction = await tx.stockTransaction.create({
        data: {
          transactionCode: stockTransactionCode,
          transactionType: 'import',
          warehouseId: order.warehouseId!,
          referenceType: 'production_order',
          referenceId: id,
          reason: `Import finished products from production order ${order.orderCode}`,
          status: 'approved',
          createdBy: userId,
          approvedBy: userId,
          approvedAt: new Date(),
          details: {
            create: {
              productId: order.finishedProductId,
              quantity: data.actualQuantity,
              unitPrice: 0,
              warehouseId: order.warehouseId!,
            },
          },
        },
      });

      const existingInventory = await tx.inventory.findFirst({
        where: {
          warehouseId: order.warehouseId!,
          productId: order.finishedProductId,
        },
      });

      if (existingInventory) {
        await tx.inventory.update({
          where: { id: existingInventory.id },
          data: {
            quantity: {
              increment: data.actualQuantity,
            },
            updatedBy: userId,
          },
        });
      } else {
        await tx.inventory.create({
          data: {
            warehouseId: order.warehouseId!,
            productId: order.finishedProductId,
            quantity: data.actualQuantity,
            reservedQuantity: 0,
            updatedBy: userId,
          },
        });
      }

      if (data.materials) {
        for (const materialInput of data.materials) {
          await tx.productionOrderMaterial.updateMany({
            where: {
              productionOrderId: id,
              materialId: materialInput.materialId,
            },
            data: {
              actualQuantity: materialInput.actualQuantity,
              wastage: materialInput.wastage || 0,
              notes: materialInput.notes,
            },
          });
        }
      }

      const totalCost = order.materials.reduce(
        (sum, mat) => sum + Number(mat.actualQuantity) * Number(mat.unitPrice),
        0
      );

      const updatedOrder = await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'completed',
          actualQuantity: data.actualQuantity,
          productionCost: totalCost,
          completedAt: new Date(),
          endDate: new Date(),
          notes: data.notes ? `${order.notes || ''}\n${data.notes}` : order.notes,
        },
        include: {
          bom: true,
          finishedProduct: true,
          warehouse: true,
          materials: {
            include: {
              material: true,
              stockTransaction: true,
            },
          },
        },
      });

      return { order: updatedOrder, stockTransaction, totalWastage };
    });

    logActivity('update', userId, 'production_orders', {
      recordId: id,
      action: 'complete_production',
      orderCode: order.orderCode,
      actualQuantity: data.actualQuantity,
      wastage: result.totalWastage,
    });

    return result;
  }

  async cancel(id: number, userId: number, data: CancelProductionInput) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        materials: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Production order not found');
    }

    if (order.status === 'completed') {
      throw new ValidationError('Cannot cancel completed production order');
    }

    if (order.status === 'cancelled') {
      throw new ValidationError('Production order is already cancelled');
    }

    let materialRollback = null;
    if (order.status === 'in_progress') {
      // TODO: Implement material rollback logic if needed
      // For now, we'll just mark as cancelled
      materialRollback = {
        message: 'Material rollback should be handled manually',
        materials: order.materials.map((m) => ({
          materialId: m.materialId,
          actualQuantity: Number(m.actualQuantity),
        })),
      };
    }

    const updatedOrder = await prisma.productionOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
        notes: `${order.notes || ''}\n[CANCELLED] ${data.reason}`,
      },
      include: {
        bom: true,
        finishedProduct: true,
        warehouse: true,
        materials: {
          include: {
            material: true,
          },
        },
        canceller: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });

    logActivity('update', userId, 'production_orders', {
      recordId: id,
      action: 'cancel_production',
      orderCode: order.orderCode,
      reason: data.reason,
    });

    return {
      order: updatedOrder,
      materialRollback,
    };
  }

  async getWastageReport(id: number) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        materials: {
          include: {
            material: {
              select: {
                id: true,
                sku: true,
                productName: true,
                unit: true,
                purchasePrice: true,
              },
            },
          },
        },
        finishedProduct: true,
        bom: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Production order not found');
    }

    const wastageDetails = order.materials.map((mat) => {
      const wastageAmount = Number(mat.wastage);
      const wastagePercentage =
        Number(mat.plannedQuantity) > 0 ? (wastageAmount / Number(mat.plannedQuantity)) * 100 : 0;
      const wastageCost = wastageAmount * Number(mat.unitPrice);

      return {
        materialId: mat.materialId,
        materialName: mat.material.productName,
        materialSku: mat.material.sku,
        materialType: mat.materialType,
        plannedQuantity: Number(mat.plannedQuantity),
        actualQuantity: Number(mat.actualQuantity),
        wastageAmount,
        wastagePercentage: Math.round(wastagePercentage * 100) / 100,
        unitPrice: Number(mat.unitPrice),
        wastageCost: Math.round(wastageCost * 100) / 100,
        unit: mat.material.unit,
      };
    });

    const totalWastageCost = wastageDetails.reduce((sum, w) => sum + w.wastageCost, 0);

    return {
      orderId: order.id,
      orderCode: order.orderCode,
      finishedProduct: {
        name: order.finishedProduct.productName,
        plannedQuantity: Number(order.plannedQuantity),
        actualQuantity: Number(order.actualQuantity),
      },
      efficiencyRate: Number(order.bom.efficiencyRate),
      wastageDetails,
      totalWastageCost: Math.round(totalWastageCost * 100) / 100,
      productionCost: Number(order.productionCost),
    };
  }

  async delete(id: number, userId: number) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Production order not found');
    }

    if (order.status !== 'pending') {
      throw new ValidationError('Can only delete production orders with pending status');
    }

    await prisma.productionOrder.delete({
      where: { id },
    });

    logActivity('delete', userId, 'production_orders', {
      recordId: id,
      orderCode: order.orderCode,
    });

    return { message: 'Production order deleted successfully' };
  }
}

export default new ProductionOrderService();
