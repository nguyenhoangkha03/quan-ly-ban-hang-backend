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

const prisma = new PrismaClient();

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

  async getAll(params: ProductionOrderQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      bomId,
      warehouseId,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

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
          _count: {
            select: {
              materials: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.productionOrder.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: number) {
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
      throw new NotFoundError('Production order not found');
    }

    return order;
  }

  async create(data: CreateProductionOrderInput, userId: number) {
    const bom = await bomService.getById(data.bomId);
    if (!bom) {
      throw new NotFoundError('BOM not found');
    }

    if (bom.status !== 'active') {
      throw new ValidationError('BOM must be active to create production order');
    }

    if (data.warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: data.warehouseId },
      });

      if (!warehouse) {
        throw new NotFoundError('Warehouse not found');
      }

      if (warehouse.status !== 'active') {
        throw new ValidationError('Warehouse must be active');
      }

      if (warehouse.warehouseType !== 'finished_product') {
        throw new ValidationError(
          'Warehouse must be of type finished_product for production orders'
        );
      }
    }

    const materialCalculation = await bomService.calculateMaterials({
      bomId: data.bomId,
      productionQuantity: data.plannedQuantity,
    });

    const materialShortages: Array<{
      materialName: string;
      required: number;
      available: number;
      shortage: number;
    }> = [];

    for (const material of materialCalculation.materials) {
      const warehouseType = material.materialType === 'raw_material' ? 'raw_material' : 'packaging';

      const inventoryRecords = await prisma.inventory.findMany({
        where: {
          productId: material.materialId,
          warehouse: {
            warehouseType,
            status: 'active',
          },
        },
        include: {
          warehouse: {
            select: {
              warehouseName: true,
            },
          },
        },
      });

      const totalAvailable = inventoryRecords.reduce(
        (sum, inv) => sum + (Number(inv.quantity) - Number(inv.reservedQuantity)),
        0
      );

      if (totalAvailable < material.totalQuantityNeeded) {
        materialShortages.push({
          materialName: material.materialName,
          required: material.totalQuantityNeeded,
          available: totalAvailable,
          shortage: material.totalQuantityNeeded - totalAvailable,
        });
      }
    }

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
          create: materialCalculation.materials.map((mat) => ({
            materialId: mat.materialId,
            plannedQuantity: mat.totalQuantityNeeded,
            unitPrice: mat.unitPrice,
            materialType: mat.materialType,
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

    logActivity('create', userId, 'production_orders', {
      recordId: productionOrder.id,
      orderCode: productionOrder.orderCode,
    });

    return {
      productionOrder,
      materialShortages: materialShortages.length > 0 ? materialShortages : undefined,
      estimatedCost: materialCalculation.totalEstimatedCost,
    };
  }

  async update(id: number, data: UpdateProductionOrderInput, userId: number) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Production order not found');
    }

    if (order.status !== 'pending') {
      throw new ValidationError('Can only update production orders with pending status');
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
      throw new NotFoundError('Production order not found');
    }

    if (order.status !== 'pending') {
      throw new ValidationError('Can only start production orders with pending status');
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
      throw new ValidationError('Insufficient materials to start production', materialShortages);
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
