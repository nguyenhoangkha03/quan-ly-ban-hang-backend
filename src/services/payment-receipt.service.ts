import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import customerService from './customer.service';
import {
  CreatePaymentReceiptInput,
  UpdatePaymentReceiptInput,
  ApproveReceiptInput,
  PostReceiptInput,
  PaymentReceiptQueryInput,
} from '@validators/payment-receipt.validator';

const prisma = new PrismaClient();

class PaymentReceiptService {
  private async generateReceiptCode(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await prisma.paymentReceipt.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    return `PT-${dateStr}-${sequence}`;
  }

  async getAll(params: PaymentReceiptQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      customerId,
      orderId,
      receiptType,
      paymentMethod,
      isPosted,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    const where: Prisma.PaymentReceiptWhereInput = {
      ...(customerId && { customerId }),
      ...(orderId && { orderId }),
      ...(receiptType && { receiptType }),
      ...(paymentMethod && { paymentMethod }),
      ...(isPosted !== undefined && { isPosted }),
      ...(search && {
        OR: [
          { receiptCode: { contains: search } },
          { customerRef: { customerName: { contains: search } } },
          { transactionReference: { contains: search } },
        ],
      }),
      ...(fromDate &&
        toDate && {
          receiptDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const [receipts, total] = await Promise.all([
      prisma.paymentReceipt.findMany({
        where,
        include: {
          customerRef: {
            select: {
              id: true,
              customerCode: true,
              customerName: true,
              phone: true,
            },
          },
          customer: {
            select: {
              id: true,
              orderCode: true,
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
      prisma.paymentReceipt.count({ where }),
    ]);

    return {
      data: receipts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: number) {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id },
      include: {
        customerRef: {
          select: {
            id: true,
            customerCode: true,
            customerName: true,
            phone: true,
            email: true,
            address: true,
            currentDebt: true,
            creditLimit: true,
          },
        },
        customer: {
          select: {
            id: true,
            orderCode: true,
            orderDate: true,
            totalAmount: true,
            paidAmount: true,
            orderStatus: true,
            paymentStatus: true,
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
      },
    });

    if (!receipt) {
      throw new NotFoundError('Payment receipt not found');
    }

    return receipt;
  }

  async create(data: CreatePaymentReceiptInput, userId: number) {
    const customer = await customerService.getById(data.customerId);

    if (customer.status !== 'active') {
      throw new ValidationError('Customer must be active to create payment receipt');
    }

    if (data.orderId) {
      const order = await prisma.salesOrder.findUnique({
        where: { id: data.orderId },
      });

      if (!order) {
        throw new NotFoundError('Sales order not found');
      }

      if (order.customerId !== data.customerId) {
        throw new ValidationError('Order does not belong to the specified customer');
      }

      const remainingAmount = Number(order.totalAmount) - Number(order.paidAmount);
      if (data.amount > remainingAmount) {
        throw new ValidationError(
          `Payment amount (${data.amount}) exceeds remaining order amount (${remainingAmount})`
        );
      }
    }

    if (data.paymentMethod === 'transfer' || data.paymentMethod === 'card') {
      if (!data.bankName) {
        throw new ValidationError('Bank name is required for transfer and card payments');
      }
    }

    const receiptCode = await this.generateReceiptCode();

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.paymentReceipt.create({
        data: {
          receiptCode,
          receiptType: data.receiptType,
          customerId: data.customerId,
          orderId: data.orderId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          bankName: data.bankName,
          transactionReference: data.transactionReference,
          receiptDate: new Date(data.receiptDate),
          notes: data.notes,
          isPosted: false,
          createdBy: userId,
        },
        include: {
          customerRef: true,
          customer: true,
          creator: true,
        },
      });

      if (data.orderId) {
        const order = await tx.salesOrder.findUnique({
          where: { id: data.orderId },
        });

        if (order) {
          const newPaidAmount = Number(order.paidAmount) + data.amount;
          let paymentStatus: 'unpaid' | 'partial' | 'paid';

          if (newPaidAmount >= Number(order.totalAmount)) {
            paymentStatus = 'paid';
          } else if (newPaidAmount > 0) {
            paymentStatus = 'partial';
          } else {
            paymentStatus = 'unpaid';
          }

          await tx.salesOrder.update({
            where: { id: data.orderId },
            data: {
              paidAmount: newPaidAmount,
              paymentStatus,
            },
          });

          if (order.orderStatus === 'completed') {
            await tx.customer.update({
              where: { id: data.customerId },
              data: {
                currentDebt: {
                  decrement: data.amount,
                },
                debtUpdatedAt: new Date(),
              },
            });
          }
        }
      } else if (data.receiptType === 'debt_collection') {
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            currentDebt: {
              decrement: data.amount,
            },
            debtUpdatedAt: new Date(),
          },
        });
      }

      return receipt;
    });

    logActivity('create', userId, 'payment_receipts', {
      recordId: result.id,
      receiptCode: result.receiptCode,
      amount: data.amount,
    });

    return result;
  }

  async update(id: number, data: UpdatePaymentReceiptInput, userId: number) {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!receipt) {
      throw new NotFoundError('Payment receipt not found');
    }

    if (receipt.isPosted) {
      throw new ValidationError('Cannot update posted receipt');
    }

    if (receipt.approvedBy) {
      throw new ValidationError('Cannot update approved receipt');
    }

    if (data.paymentMethod === 'transfer' || data.paymentMethod === 'card') {
      if (!data.bankName && !receipt.bankName) {
        throw new ValidationError('Bank name is required for transfer and card payments');
      }
    }

    const needsFinancialUpdate = data.amount && Number(data.amount) !== Number(receipt.amount);

    if (needsFinancialUpdate) {
      await this.revertFinancialImpact(receipt, userId);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedReceipt = await tx.paymentReceipt.update({
        where: { id },
        data: {
          ...(data.receiptType && { receiptType: data.receiptType }),
          ...(data.amount !== undefined && { amount: data.amount }),
          ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
          ...(data.bankName !== undefined && { bankName: data.bankName }),
          ...(data.transactionReference !== undefined && {
            transactionReference: data.transactionReference,
          }),
          ...(data.receiptDate && { receiptDate: new Date(data.receiptDate) }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
        include: {
          customerRef: true,
          customer: true,
        },
      });

      if (needsFinancialUpdate) {
        await this.applyFinancialImpact(updatedReceipt, userId);
      }

      return updatedReceipt;
    });

    logActivity('update', userId, 'payment_receipts', {
      recordId: id,
      receiptCode: receipt.receiptCode,
      changes: data,
    });

    return result;
  }

  async approve(id: number, userId: number, data?: ApproveReceiptInput) {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id },
    });

    if (!receipt) {
      throw new NotFoundError('Payment receipt not found');
    }

    if (receipt.isPosted) {
      throw new ValidationError('Cannot approve posted receipt');
    }

    if (receipt.approvedBy) {
      throw new ValidationError('Receipt is already approved');
    }

    const updatedReceipt = await prisma.paymentReceipt.update({
      where: { id },
      data: {
        approvedBy: userId,
        approvedAt: new Date(),
        notes: data?.notes ? `${receipt.notes || ''}\n${data.notes}` : receipt.notes,
      },
      include: {
        customerRef: true,
        customer: true,
        creator: true,
        approver: true,
      },
    });

    logActivity('update', userId, 'payment_receipts', {
      recordId: id,
      action: 'approve_receipt',
      receiptCode: receipt.receiptCode,
    });

    return updatedReceipt;
  }

  async post(id: number, userId: number, data?: PostReceiptInput) {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id },
    });

    if (!receipt) {
      throw new NotFoundError('Payment receipt not found');
    }

    if (receipt.isPosted) {
      throw new ValidationError('Receipt is already posted');
    }

    if (!receipt.approvedBy) {
      throw new ValidationError('Receipt must be approved before posting');
    }

    const updatedReceipt = await prisma.paymentReceipt.update({
      where: { id },
      data: {
        isPosted: true,
        notes: data?.notes ? `${receipt.notes || ''}\n[POSTED] ${data.notes}` : receipt.notes,
      },
      include: {
        customerRef: true,
        customer: true,
        creator: true,
        approver: true,
      },
    });

    logActivity('update', userId, 'payment_receipts', {
      recordId: id,
      action: 'post_receipt',
      receiptCode: receipt.receiptCode,
    });

    return updatedReceipt;
  }

  async delete(id: number, userId: number) {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!receipt) {
      throw new NotFoundError('Payment receipt not found');
    }

    if (receipt.isPosted) {
      throw new ValidationError('Cannot delete posted receipt');
    }

    if (receipt.approvedBy) {
      throw new ValidationError('Cannot delete approved receipt');
    }

    await prisma.$transaction(async (tx) => {
      await this.revertFinancialImpact(receipt, userId);

      await tx.paymentReceipt.delete({
        where: { id },
      });
    });

    logActivity('delete', userId, 'payment_receipts', {
      recordId: id,
      receiptCode: receipt.receiptCode,
    });

    return { message: 'Payment receipt deleted successfully' };
  }

  private async applyFinancialImpact(receipt: any, _userId: number) {
    if (receipt.orderId) {
      const order = await prisma.salesOrder.findUnique({
        where: { id: receipt.orderId },
      });

      if (order) {
        const newPaidAmount = Number(order.paidAmount) + Number(receipt.amount);
        let paymentStatus: 'unpaid' | 'partial' | 'paid';

        if (newPaidAmount >= Number(order.totalAmount)) {
          paymentStatus = 'paid';
        } else if (newPaidAmount > 0) {
          paymentStatus = 'partial';
        } else {
          paymentStatus = 'unpaid';
        }

        await prisma.salesOrder.update({
          where: { id: receipt.orderId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus,
          },
        });

        if (order.orderStatus === 'completed') {
          await prisma.customer.update({
            where: { id: receipt.customerId },
            data: {
              currentDebt: {
                decrement: Number(receipt.amount),
              },
              debtUpdatedAt: new Date(),
            },
          });
        }
      }
    } else if (receipt.receiptType === 'debt_collection') {
      await prisma.customer.update({
        where: { id: receipt.customerId },
        data: {
          currentDebt: {
            decrement: Number(receipt.amount),
          },
          debtUpdatedAt: new Date(),
        },
      });
    }
  }

  private async revertFinancialImpact(receipt: any, _userId: number) {
    if (receipt.orderId) {
      const order = await prisma.salesOrder.findUnique({
        where: { id: receipt.orderId },
      });

      if (order) {
        const newPaidAmount = Number(order.paidAmount) - Number(receipt.amount);
        let paymentStatus: 'unpaid' | 'partial' | 'paid';

        if (newPaidAmount >= Number(order.totalAmount)) {
          paymentStatus = 'paid';
        } else if (newPaidAmount > 0) {
          paymentStatus = 'partial';
        } else {
          paymentStatus = 'unpaid';
        }

        await prisma.salesOrder.update({
          where: { id: receipt.orderId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus,
          },
        });

        if (order.orderStatus === 'completed') {
          await prisma.customer.update({
            where: { id: receipt.customerId },
            data: {
              currentDebt: {
                increment: Number(receipt.amount),
              },
              debtUpdatedAt: new Date(),
            },
          });
        }
      }
    } else if (receipt.receiptType === 'debt_collection') {
      await prisma.customer.update({
        where: { id: receipt.customerId },
        data: {
          currentDebt: {
            increment: Number(receipt.amount),
          },
          debtUpdatedAt: new Date(),
        },
      });
    }
  }

  async getByCustomer(customerId: number) {
    const receipts = await prisma.paymentReceipt.findMany({
      where: { customerId },
      include: {
        customer: {
          select: {
            id: true,
            orderCode: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: {
        receiptDate: 'desc',
      },
    });

    return receipts;
  }

  async getSummary(fromDate?: string, toDate?: string) {
    const where: Prisma.PaymentReceiptWhereInput = {
      isPosted: true,
      ...(fromDate &&
        toDate && {
          receiptDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const receipts = await prisma.paymentReceipt.findMany({
      where,
      select: {
        receiptType: true,
        paymentMethod: true,
        amount: true,
      },
    });

    const totalAmount = receipts.reduce((sum, r) => sum + Number(r.amount), 0);

    const byType = receipts.reduce((acc, r) => {
      acc[r.receiptType] = (acc[r.receiptType] || 0) + Number(r.amount);
      return acc;
    }, {} as Record<string, number>);

    const byMethod = receipts.reduce((acc, r) => {
      acc[r.paymentMethod] = (acc[r.paymentMethod] || 0) + Number(r.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalReceipts: receipts.length,
      totalAmount,
      byType,
      byMethod,
    };
  }
}

export default new PaymentReceiptService();
