import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import customerService from './customer.service';
import {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  ApproveOrderInput,
  CancelOrderInput,
  ProcessPaymentInput,
  SalesOrderQueryInput,
} from '@validators/sales-order.validator';

const prisma = new PrismaClient();

class SalesOrderService {
  private async generateOrderCode(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await prisma.salesOrder.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    return `DH-${dateStr}-${sequence}`;
  }

  async getAll(params: SalesOrderQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      customerId ,
      orderStatus,
      paymentStatus,
      salesChannel,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = {
      ...(customerId && { customerId }),
      ...(orderStatus && { orderStatus }),
      ...(paymentStatus && { paymentStatus }),
      ...(salesChannel && { salesChannel }),
      ...(search && {
        OR: [
          { orderCode: { contains: search } },
          { customer: { customerName: { contains: search } } },
          { customer: { phone: { contains: search } } },
        ],
      }),
      ...(fromDate &&
        toDate && {
          orderDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              customerCode: true,
              customerName: true,
              phone: true,
              classification: true,
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
          _count: {
            select: {
              details: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.salesOrder.count({ where }),
    ]);

    const ordersWithRemaining = orders.map((order) => ({
      ...order,
      remainingAmount: Number(order.totalAmount) - Number(order.paidAmount),
    }));

    return {
      data: ordersWithRemaining,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: number) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerName: true,
            phone: true,
            email: true,
            address: true,
            classification: true,
            creditLimit: true,
            currentDebt: true,
          },
        },
        warehouse: true,
        details: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                productName: true,
                unit: true,
                productType: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                warehouseName: true,
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
          },
        },
        canceller: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        deliveries: {
          select: {
            id: true,
            deliveryCode: true,
            deliveryStatus: true,
            deliveryDate: true,
          },
        },
        paymentReceipts: {
          select: {
            id: true,
            receiptCode: true,
            amount: true,
            receiptDate: true,
            paymentMethod: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Sales order not found');
    }

    return {
      ...order,
      remainingAmount: Number(order.totalAmount) - Number(order.paidAmount),
    };
  }

  async create(data: CreateSalesOrderInput, userId: number) {
    // Validate customer
    const customer = await customerService.getById(data.customerId);
    if (customer.status !== 'active') {
      throw new ValidationError('Customer must be active to create order');
    }

    if (data.warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: data.warehouseId },
      });

      if (!warehouse || warehouse.status !== 'active') {
        throw new ValidationError('Warehouse must exist and be active');
      }
    }

    const productIds = data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundError('One or more products not found');
    }

    for (const product of products) {
      if (product.status !== 'active') {
        throw new ValidationError(`Product "${product.productName}" is not active`);
      }
    }

    const inventoryShortages: Array<{
      productName: string;
      requested: number;
      available: number;
    }> = [];

    for (const item of data.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      const warehouseId = item.warehouseId || data.warehouseId;
      if (warehouseId) {
        const inventory = await prisma.inventory.findFirst({
          where: {
            productId: item.productId,
            warehouseId,
          },
        });

        if (inventory) {
          const available = Number(inventory.quantity) - Number(inventory.reservedQuantity);
          if (available < item.quantity) {
            inventoryShortages.push({
              productName: product.productName,
              requested: item.quantity,
              available,
            });
          }
        } else {
          inventoryShortages.push({
            productName: product.productName,
            requested: item.quantity,
            available: 0,
          });
        }
      }
    }

    let subtotal = 0;
    const itemsWithCalculations = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const discountPercent = item.discountPercent || 0;
      const taxRate = product?.taxRate || 0;

      const lineTotal = item.quantity * item.unitPrice;
      const discountAmount = lineTotal * (discountPercent / 100);
      const taxableAmount = lineTotal - discountAmount;
      const taxAmount = taxableAmount * (Number(taxRate) / 100);
      const lineAmount = taxableAmount + taxAmount;

      subtotal += lineAmount;

      return {
        ...item,
        taxRate: Number(taxRate),
      };
    });

    const totalAmount = subtotal + (data.shippingFee || 0) - (data.discountAmount || 0);
    const paidAmount = data.paidAmount || 0;
    
    // Validate payment amount vs total
    if (paidAmount > totalAmount) {
      throw new ValidationError(
        `Paid amount (${paidAmount}) cannot exceed total amount (${totalAmount})`
      );
    }

    // For credit/installment payment, check remaining debt
    if ((data.paymentMethod === 'credit' || data.paymentMethod === 'installment') && paidAmount < totalAmount) {
      const debtFromThisOrder = totalAmount - paidAmount;
      const newDebt = Number(customer.currentDebt) + debtFromThisOrder;
      if (newDebt > Number(customer.creditLimit)) {
        throw new ValidationError(
          `Order exceeds customer credit limit. Current debt: ${customer.currentDebt}, New debt from order: ${debtFromThisOrder}, Credit limit: ${customer.creditLimit}`
        );
      }
    }

    const orderCode = await this.generateOrderCode();

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.create({
        data: {
          orderCode,
          customerId: data.customerId,
          warehouseId: data.warehouseId,
          orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
          salesChannel: data.salesChannel || 'retail',
          totalAmount,
          discountAmount: data.discountAmount || 0,
          shippingFee: data.shippingFee || 0,
          taxAmount: 0,
          paidAmount,
          paymentMethod: data.paymentMethod,
          paymentStatus: paidAmount >= totalAmount ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'),
          orderStatus: 'pending',
          deliveryAddress: data.deliveryAddress,
          notes: data.notes,
          createdBy: userId,
          details: {
            create: itemsWithCalculations.map((item) => ({
              productId: item.productId,
              warehouseId: item.warehouseId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent || 0,
              taxRate: item.taxRate,
              notes: item.notes,
            })),
          },
        },
        include: {
          customer: true,
          details: {
            include: {
              product: true,
            },
          },
        },
      });

      for (const item of data.items) {
        const warehouseId = item.warehouseId || data.warehouseId;
        if (warehouseId) {
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              warehouseId,
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                reservedQuantity: {
                  increment: item.quantity,
                },
                updatedBy: userId,
              },
            });
          }
        }
      }

      return order;
    });

    logActivity('create', userId, 'sales_orders', {
      recordId: result.id,
      orderCode: result.orderCode,
    });

    return {
      order: result,
      inventoryShortages: inventoryShortages.length > 0 ? inventoryShortages : undefined,
    };
  }

  async update(id: number, data: UpdateSalesOrderInput, userId: number) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Sales order not found');
    }

    if (order.orderStatus !== 'pending') {
      throw new ValidationError('Can only update orders with pending status');
    }

    const updatedOrder = await prisma.salesOrder.update({
      where: { id },
      data: {
        ...(data.orderDate && { orderDate: new Date(data.orderDate) }),
        ...(data.salesChannel && { salesChannel: data.salesChannel }),
        ...(data.deliveryAddress !== undefined && { deliveryAddress: data.deliveryAddress }),
        ...(data.discountAmount !== undefined && { discountAmount: data.discountAmount }),
        ...(data.shippingFee !== undefined && { shippingFee: data.shippingFee }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        customer: true,
        details: {
          include: {
            product: true,
          },
        },
      },
    });

    logActivity('update', userId, 'sales_orders', {
      recordId: id,
      orderCode: order.orderCode,
      changes: data,
    });

    return updatedOrder;
  }

  async approve(id: number, userId: number, data?: ApproveOrderInput) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        details: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Sales order not found');
    }

    if (order.orderStatus !== 'pending') {
      throw new ValidationError('Can only approve orders with pending status');
    }

    const updatedOrder = await prisma.salesOrder.update({
      where: { id },
      data: {
        orderStatus: 'preparing',
        approvedBy: userId,
        approvedAt: new Date(),
        notes: data?.notes ? `${order.notes || ''}\n${data.notes}` : order.notes,
      },
      include: {
        customer: true,
        details: {
          include: {
            product: true,
          },
        },
      },
    });

    logActivity('update', userId, 'sales_orders', {
      recordId: id,
      action: 'approve_order',
      orderCode: order.orderCode,
    });

    return updatedOrder;
  }

  async complete(id: number, userId: number) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        details: true,
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Sales order not found');
    }

    if (order.orderStatus !== 'delivering') {
      throw new ValidationError('Can only complete orders with delivering status');
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const detail of order.details) {
        if (detail.warehouseId) {
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: detail.productId,
              warehouseId: detail.warehouseId,
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: {
                  decrement: detail.quantity,
                },
                reservedQuantity: {
                  decrement: detail.quantity,
                },
                updatedBy: userId,
              },
            });
          }
        }
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id },
        data: {
          orderStatus: 'completed',
          completedAt: new Date(),
        },
        include: {
          customer: true,
          details: {
            include: {
              product: true,
            },
          },
        },
      });

      if (order.paymentStatus !== 'paid') {
        const debtAmount = Number(order.totalAmount) - Number(order.paidAmount);
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            currentDebt: {
              increment: debtAmount,
            },
            debtUpdatedAt: new Date(),
          },
        });
      }

      return updatedOrder;
    });

    logActivity('update', userId, 'sales_orders', {
      recordId: id,
      action: 'complete_order',
      orderCode: order.orderCode,
    });

    return result;
  }

  async cancel(id: number, userId: number, data: CancelOrderInput) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        details: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Sales order not found');
    }

    if (order.orderStatus === 'completed') {
      throw new ValidationError('Cannot cancel completed order');
    }

    if (order.orderStatus === 'cancelled') {
      throw new ValidationError('Order is already cancelled');
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const detail of order.details) {
        if (detail.warehouseId) {
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: detail.productId,
              warehouseId: detail.warehouseId,
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                reservedQuantity: {
                  decrement: detail.quantity,
                },
                updatedBy: userId,
              },
            });
          }
        }
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id },
        data: {
          orderStatus: 'cancelled',
          cancelledBy: userId,
          cancelledAt: new Date(),
          notes: `${order.notes || ''}\n[CANCELLED] ${data.reason}`,
        },
        include: {
          customer: true,
          details: {
            include: {
              product: true,
            },
          },
        },
      });

      return updatedOrder;
    });

    logActivity('update', userId, 'sales_orders', {
      recordId: id,
      action: 'cancel_order',
      orderCode: order.orderCode,
      reason: data.reason,
    });

    return result;
  }

  async processPayment(id: number, userId: number, data: ProcessPaymentInput) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Sales order not found');
    }

    if (order.orderStatus === 'cancelled') {
      throw new ValidationError('Cannot process payment for cancelled order');
    }

    const remainingAmount = Number(order.totalAmount) - Number(order.paidAmount);
    if (data.paidAmount > remainingAmount) {
      throw new ValidationError(
        `Payment amount (${data.paidAmount}) exceeds remaining amount (${remainingAmount})`
      );
    }

    const newPaidAmount = Number(order.paidAmount) + data.paidAmount;
    let paymentStatus: 'unpaid' | 'partial' | 'paid';

    if (newPaidAmount >= Number(order.totalAmount)) {
      paymentStatus = 'paid';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'unpaid';
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.salesOrder.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus,
          paymentMethod: data.paymentMethod,
        },
        include: {
          customer: true,
        },
      });

      if (order.orderStatus === 'completed' && order.paymentStatus !== 'paid') {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            currentDebt: {
              decrement: data.paidAmount,
            },
            debtUpdatedAt: new Date(),
          },
        });
      }

      const receiptCode = `PT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${
        Date.now() % 1000
      }`;

      const financePaymentMethod =
        data.paymentMethod === 'cash'
          ? 'cash'
          : data.paymentMethod === 'transfer'
          ? 'transfer'
          : 'card';

      await tx.paymentReceipt.create({
        data: {
          receiptCode,
          receiptType: 'sales',
          customerId: order.customerId,
          orderId: id,
          amount: data.paidAmount,
          receiptDate: new Date(),
          paymentMethod: financePaymentMethod,
          notes: data.notes,
          createdBy: userId,
        },
      });

      return updatedOrder;
    });

    logActivity('update', userId, 'sales_orders', {
      recordId: id,
      action: 'process_payment',
      orderCode: order.orderCode,
      paidAmount: data.paidAmount,
    });

    return result;
  }

  async delete(id: number, userId: number) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        details: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Sales order not found');
    }

    if (order.orderStatus !== 'pending') {
      throw new ValidationError('Can only delete orders with pending status');
    }

    await prisma.$transaction(async (tx) => {
      for (const detail of order.details) {
        if (detail.warehouseId) {
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: detail.productId,
              warehouseId: detail.warehouseId,
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                reservedQuantity: {
                  decrement: detail.quantity,
                },
                updatedBy: userId,
              },
            });
          }
        }
      }

      await tx.salesOrder.delete({
        where: { id },
      });
    });

    logActivity('delete', userId, 'sales_orders', {
      recordId: id,
      orderCode: order.orderCode,
    });

    return { message: 'Sales order deleted successfully' };
  }
}

export default new SalesOrderService();
