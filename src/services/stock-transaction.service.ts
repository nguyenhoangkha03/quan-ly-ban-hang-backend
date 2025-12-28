import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import inventoryService from './inventory.service';
import {
  type CreateImportInput,
  type TransactionQueryInput,
} from '@validators/stock-transaction.validator';
import RedisService from './redis.service';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const STOCK_TRANSACTION_CACHE_TTL = parseInt(process.env.STOCK_TRANSACTION_CACHE_TTL || '300');

class StockTransactionService {
  private async generateTransactionCode(type: string): Promise<string> {
    const prefixes: Record<string, string> = {
      import: 'PNK',
      export: 'PXK',
      transfer: 'PCK',
      disposal: 'PXH',
      stocktake: 'PKK',
    };

    const prefix = prefixes[type] || 'STK';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await prisma.stockTransaction.count({
      where: {
        transactionType: type as any,
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    return `${prefix}-${dateStr}-${sequence}`;
  }

  async getAll(query: TransactionQueryInput) {
    const {
      page = '1',
      limit = '20',
      search = '',
      transactionType,
      warehouseId,
      status,
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
    const cacheKey = `stock-transaction:list:${queryString}`;

    const cache = await redis.get(cacheKey);
    if (cache) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cache;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const where: Prisma.StockTransactionWhereInput = {
      ...(search && {
        OR: [
          { transactionCode: { contains: search } },
          { creator: { fullName: { contains: search } } },
        ],
      }),
      ...(transactionType && { transactionType: transactionType as any }),
      ...(status && { status: status as any }),
      ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
      ...(fromDate &&
        toDate && {
          createdAt: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const total = await prisma.stockTransaction.count({ where });

    const transactions = await prisma.stockTransaction.findMany({
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
        sourceWarehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseCode: true,
          },
        },
        destinationWarehouse: {
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
        details: true,
        approver: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        _count: {
          select: {
            details: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: skip,
      take: limitNum,
    });

    const result = {
      data: transactions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'Success',
    };

    await redis.set(cacheKey, result, STOCK_TRANSACTION_CACHE_TTL);

    return result;
  }

  async getById(id: number) {
    const cacheKey = `stock-transaction:${id}`;

    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const transaction = await prisma.stockTransaction.findUnique({
      where: { id },
      include: {
        warehouse: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
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
        canceller: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        details: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                productName: true,
                productType: true,
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
        },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Stock transaction');
    }

    await redis.set(cacheKey, transaction, STOCK_TRANSACTION_CACHE_TTL);

    return transaction;
  }

  async createImport(data: CreateImportInput, userId: number) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse');
    }

    for (const detail of data.details) {
      const product = await prisma.product.findUnique({
        where: { id: detail.productId },
      });
      if (!product) {
        throw new NotFoundError(`Sản phẩm với ID ${detail.productId}`);
      }
    }

    const transactionCode = await this.generateTransactionCode('import');

    const totalValue = data.details.reduce(
      (sum, item) => sum + (item.unitPrice || 0) * item.quantity,
      0
    );

    const transaction = await prisma.stockTransaction.create({
      data: {
        transactionCode,
        transactionType: 'import',
        warehouseId: data.warehouseId,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        totalValue,
        reason: data.reason,
        notes: data.notes,
        status: 'pending',
        createdBy: userId,
        details: {
          create: data.details.map((item) => ({
            productId: item.productId,
            warehouseId: data.warehouseId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            notes: item.notes,
          })),
        },
      },
      include: {
        details: {
          include: {
            product: true,
          },
        },
        warehouse: true,
        creator: true,
      },
    });

    logActivity('create', userId, 'stock_transactions', {
      recordId: transaction.id,
      newValue: transaction,
    });

    // Invalidate cache
    await redis.flushPattern('stock-transaction:list:*');

    return transaction;
  }

  async createExport(
    data: {
      warehouseId: number;
      referenceType?: string;
      referenceId?: number;
      reason?: string;
      notes?: string;
      details: Array<{
        productId: number;
        quantity: number;
        batchNumber?: string;
        notes?: string;
      }>;
    },
    userId: number
  ) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundError('Warehouse');
    }

    const checkResult = await inventoryService.checkAvailability(
      data.details.map((d) => ({
        productId: d.productId,
        warehouseId: data.warehouseId,
        quantity: d.quantity,
      }))
    );

    if (!checkResult.allAvailable) {
      throw new ValidationError('Insufficient inventory for export', {
        unavailableItems: checkResult.items.filter((i) => !i.isAvailable),
      });
    }

    const transactionCode = await this.generateTransactionCode('export');

    const transaction = await prisma.stockTransaction.create({
      data: {
        transactionCode,
        transactionType: 'export',
        warehouseId: data.warehouseId,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        reason: data.reason,
        notes: data.notes,
        status: 'pending',
        createdBy: userId,
        details: {
          create: data.details.map((item) => ({
            productId: item.productId,
            warehouseId: data.warehouseId,
            quantity: item.quantity,
            batchNumber: item.batchNumber,
            notes: item.notes,
          })),
        },
      },
      include: {
        details: {
          include: {
            product: true,
          },
        },
        warehouse: true,
        creator: true,
      },
    });

    logActivity('create', userId, 'stock_transactions', {
      recordId: transaction.id,
      newValue: transaction,
    });

    return transaction;
  }

  async createTransfer(
    data: {
      sourceWarehouseId: number;
      destinationWarehouseId: number;
      reason?: string;
      notes?: string;
      details: Array<{
        productId: number;
        quantity: number;
        batchNumber?: string;
        notes?: string;
      }>;
    },
    userId: number
  ) {
    const sourceWarehouse = await prisma.warehouse.findUnique({
      where: { id: data.sourceWarehouseId },
    });
    if (!sourceWarehouse) {
      throw new NotFoundError('Source warehouse');
    }

    const destWarehouse = await prisma.warehouse.findUnique({
      where: { id: data.destinationWarehouseId },
    });
    if (!destWarehouse) {
      throw new NotFoundError('Destination warehouse');
    }

    if (data.sourceWarehouseId === data.destinationWarehouseId) {
      throw new ValidationError('Source and destination warehouses must be different');
    }

    const checkResult = await inventoryService.checkAvailability(
      data.details.map((d) => ({
        productId: d.productId,
        warehouseId: data.sourceWarehouseId,
        quantity: d.quantity,
      }))
    );

    if (!checkResult.allAvailable) {
      throw new ValidationError('Insufficient inventory in source warehouse', {
        unavailableItems: checkResult.items.filter((i) => !i.isAvailable),
      });
    }

    const transactionCode = await this.generateTransactionCode('transfer');

    const transaction = await prisma.stockTransaction.create({
      data: {
        transactionCode,
        transactionType: 'transfer',
        warehouseId: data.sourceWarehouseId,
        sourceWarehouseId: data.sourceWarehouseId,
        destinationWarehouseId: data.destinationWarehouseId,
        reason: data.reason,
        notes: data.notes,
        status: 'pending',
        createdBy: userId,
        details: {
          create: data.details.map((item) => ({
            productId: item.productId,
            warehouseId: data.sourceWarehouseId,
            quantity: item.quantity,
            batchNumber: item.batchNumber,
            notes: item.notes,
          })),
        },
      },
      include: {
        details: {
          include: {
            product: true,
          },
        },
        sourceWarehouse: true,
        destinationWarehouse: true,
        creator: true,
      },
    });

    logActivity('create', userId, 'stock_transactions', {
      recordId: transaction.id,
      newValue: transaction,
    });

    return transaction;
  }

  async createDisposal(
    data: {
      warehouseId: number;
      reason: string;
      notes?: string;
      details: Array<{
        productId: number;
        quantity: number;
        batchNumber?: string;
        notes?: string;
      }>;
    },
    userId: number
  ) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundError('Warehouse');
    }

    const checkResult = await inventoryService.checkAvailability(
      data.details.map((d) => ({
        productId: d.productId,
        warehouseId: data.warehouseId,
        quantity: d.quantity,
      }))
    );

    if (!checkResult.allAvailable) {
      throw new ValidationError('Insufficient inventory for disposal', {
        unavailableItems: checkResult.items.filter((i) => !i.isAvailable),
      });
    }

    const transactionCode = await this.generateTransactionCode('disposal');

    const transaction = await prisma.stockTransaction.create({
      data: {
        transactionCode,
        transactionType: 'disposal',
        warehouseId: data.warehouseId,
        reason: data.reason,
        notes: data.notes,
        status: 'pending',
        createdBy: userId,
        details: {
          create: data.details.map((item) => ({
            productId: item.productId,
            warehouseId: data.warehouseId,
            quantity: item.quantity,
            batchNumber: item.batchNumber,
            notes: item.notes,
          })),
        },
      },
      include: {
        details: {
          include: {
            product: true,
          },
        },
        warehouse: true,
        creator: true,
      },
    });

    logActivity('create', userId, 'stock_transactions', {
      recordId: transaction.id,
      newValue: transaction,
    });

    return transaction;
  }

  async createStocktake(
    data: {
      warehouseId: number;
      reason?: string;
      notes?: string;
      details: Array<{
        productId: number;
        systemQuantity: number;
        actualQuantity: number;
        batchNumber?: string;
        notes?: string;
      }>;
    },
    userId: number
  ) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundError('Warehouse');
    }

    const transactionCode = await this.generateTransactionCode('stocktake');

    const details = data.details.map((item) => ({
      productId: item.productId,
      warehouseId: data.warehouseId,
      quantity: item.actualQuantity - item.systemQuantity,
      batchNumber: item.batchNumber,
      notes: item.notes
        ? `${item.notes} (System: ${item.systemQuantity}, Actual: ${item.actualQuantity})`
        : `System: ${item.systemQuantity}, Actual: ${item.actualQuantity}`,
    }));

    const transaction = await prisma.stockTransaction.create({
      data: {
        transactionCode,
        transactionType: 'stocktake',
        warehouseId: data.warehouseId,
        reason: data.reason,
        notes: data.notes,
        status: 'pending',
        createdBy: userId,
        details: {
          create: details,
        },
      },
      include: {
        details: {
          include: {
            product: true,
          },
        },
        warehouse: true,
        creator: true,
      },
    });

    logActivity('create', userId, 'stock_transactions', {
      recordId: transaction.id,
      newValue: transaction,
    });

    return transaction;
  }

  async approve(id: number, userId: number, notes?: string) {
    const transaction = await this.getById(id);

    if (transaction.status !== 'pending') {
      throw new ValidationError(`Giao dịch không thể phê duyệt. Trạng thái: ${transaction.status}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedTransaction = await tx.stockTransaction.update({
        where: { id },
        data: {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          notes: notes ? `${transaction.notes || ''} - Phê duyệt: ${notes}` : transaction.notes,
        },
        include: {
          details: {
            include: {
              product: true,
            },
          },
          warehouse: true,
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });

      switch (transaction.transactionType) {
        case 'import':
          await this.processImport(tx, transaction, userId);
          break;
        case 'export':
          await this.processExport(tx, transaction, userId);
          break;
        case 'transfer':
          await this.processTransfer(tx, transaction, userId);
          break;
        case 'disposal':
          await this.processDisposal(tx, transaction, userId);
          break;
        case 'stocktake':
          await this.processStocktake(tx, transaction, userId);
          break;
      }

      return updatedTransaction;
    });

    logActivity('update', userId, 'stock_transactions', {
      recordId: id,
      action: 'approve',
      oldValue: { status: transaction.status },
      newValue: { status: 'approved' },
    });

    await redis.flushPattern('stock-transaction:list:*');
    await redis.del(`stock-transaction:${id}`);

    return result;
  }

  private async processImport(tx: any, transaction: any, userId: number) {
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: transaction.referenceId },
    });

    for (const detail of transaction.details) {
      const current = await tx.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.warehouseId,
            productId: detail.productId,
          },
        },
      });

      const newQuantity = (current ? Number(current.quantity) : 0) + Number(detail.quantity);

      // Tăng số lượng tồn kho trong Inventory
      await tx.inventory.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.warehouseId,
            productId: detail.productId,
          },
        },
        create: {
          warehouseId: transaction.warehouseId,
          productId: detail.productId,
          quantity: newQuantity,
          reservedQuantity: 0,
          updatedBy: userId,
        },
        update: {
          quantity: newQuantity,
          updatedBy: userId,
        },
      });

      // Cập nhật giá nhập mới nhất vào Product
      if (detail.unitPrice) {
        await tx.product.update({
          where: { id: detail.productId },
          data: {
            purchasePrice: Number(detail.unitPrice),
            expiryDate: detail.expiryDate,
            taxRate: purchaseOrder ? purchaseOrder.taxRate : undefined,
            supplierId: purchaseOrder ? purchaseOrder.supplierId : undefined,
          },
        });
      }
    }

    // Ghi nhận công nợ phải trả cho supplier (nếu là purchase order)
    if (transaction.referenceType === 'purchase_order' && transaction.referenceId) {
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id: transaction.referenceId },
      });

      if (purchaseOrder) {
        // Lấy supplier hiện tại
        const supplier = await tx.supplier.findUnique({
          where: { id: purchaseOrder.supplierId },
        });

        // Tính công nợ mới = công nợ cũ + tiền đơn hàng
        const newPayable =
          (supplier ? Number(supplier.totalPayable) || 0 : 0) + Number(purchaseOrder.totalAmount);

        // Update supplier debt
        await tx.supplier.update({
          where: { id: purchaseOrder.supplierId },
          data: {
            totalPayable: newPayable,
            payableUpdatedAt: new Date(),
          },
        });

        // Cập nhật PO status → 'received'
        await tx.purchaseOrder.update({
          where: { id: transaction.referenceId },
          data: {
            status: 'received',
          },
        });
      }
    }
  }

  private async processExport(tx: any, transaction: any, userId: number) {
    for (const detail of transaction.details) {
      const current = await tx.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.warehouseId,
            productId: detail.productId,
          },
        },
      });

      if (!current) {
        throw new ValidationError(`No inventory found for product ${detail.productId}`);
      }

      const newQuantity = Number(current.quantity) - Number(detail.quantity);

      if (newQuantity < 0) {
        throw new ValidationError(
          `Insufficient inventory for product ${detail.product.productName}`
        );
      }

      await tx.inventory.update({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.warehouseId,
            productId: detail.productId,
          },
        },
        data: {
          quantity: newQuantity,
          updatedBy: userId,
        },
      });
    }
  }

  private async processTransfer(tx: any, transaction: any, userId: number) {
    for (const detail of transaction.details) {
      const sourceInventory = await tx.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.sourceWarehouseId,
            productId: detail.productId,
          },
        },
      });

      if (!sourceInventory) {
        throw new ValidationError(
          `No inventory in source warehouse for product ${detail.productId}`
        );
      }

      const newSourceQty = Number(sourceInventory.quantity) - Number(detail.quantity);

      if (newSourceQty < 0) {
        throw new ValidationError(`Insufficient inventory in source warehouse`);
      }

      await tx.inventory.update({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.sourceWarehouseId,
            productId: detail.productId,
          },
        },
        data: {
          quantity: newSourceQty,
          updatedBy: userId,
        },
      });

      const destInventory = await tx.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.destinationWarehouseId,
            productId: detail.productId,
          },
        },
      });

      const newDestQty =
        (destInventory ? Number(destInventory.quantity) : 0) + Number(detail.quantity);

      await tx.inventory.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.destinationWarehouseId,
            productId: detail.productId,
          },
        },
        create: {
          warehouseId: transaction.destinationWarehouseId,
          productId: detail.productId,
          quantity: newDestQty,
          reservedQuantity: 0,
          updatedBy: userId,
        },
        update: {
          quantity: newDestQty,
          updatedBy: userId,
        },
      });
    }
  }

  private async processDisposal(tx: any, transaction: any, userId: number) {
    // Same as export
    await this.processExport(tx, transaction, userId);
  }

  private async processStocktake(tx: any, transaction: any, userId: number) {
    for (const detail of transaction.details) {
      const adjustment = Number(detail.quantity);

      if (adjustment === 0) continue;

      const current = await tx.inventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.warehouseId,
            productId: detail.productId,
          },
        },
      });

      const currentQty = current ? Number(current.quantity) : 0;
      const newQuantity = currentQty + adjustment;

      if (newQuantity < 0) {
        throw new ValidationError(
          `Invalid stocktake: would result in negative inventory for product ${detail.productId}`
        );
      }

      await tx.inventory.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: transaction.warehouseId,
            productId: detail.productId,
          },
        },
        create: {
          warehouseId: transaction.warehouseId,
          productId: detail.productId,
          quantity: newQuantity,
          reservedQuantity: 0,
          updatedBy: userId,
        },
        update: {
          quantity: newQuantity,
          updatedBy: userId,
        },
      });
    }
  }

  async cancel(id: number, userId: number, reason: string) {
    const transaction = await this.getById(id);

    if (transaction.status === 'cancelled') {
      throw new ValidationError('Transaction is already cancelled');
    }

    if (transaction.status === 'approved') {
      throw new ValidationError(
        'Cannot cancel approved transaction. Please create a reversal transaction instead.'
      );
    }

    const updated = await prisma.stockTransaction.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
        notes: `${transaction.notes || ''}\nCancellation reason: ${reason}`,
      },
      include: {
        details: {
          include: {
            product: true,
          },
        },
        warehouse: true,
      },
    });

    logActivity('update', userId, 'stock_transactions', {
      recordId: id,
      action: 'cancel',
      oldValue: { status: transaction.status },
      newValue: { status: 'cancelled' },
      reason,
    });

    return updated;
  }
}

export default new StockTransactionService();
