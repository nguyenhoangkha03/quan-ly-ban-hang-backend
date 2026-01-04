import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import {
  CreatePaymentVoucherInput,
  UpdatePaymentVoucherInput,
  ApproveVoucherInput,
  PostVoucherInput,
  PaymentVoucherQueryInput,
} from '@validators/payment-voucher.validator';



const prisma = new PrismaClient();

class PaymentVoucherService {
  private async generateVoucherCode(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await prisma.paymentVoucher.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    return `PC-${dateStr}-${sequence}`;
  }

  async getAll(params: PaymentVoucherQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      supplierId,
      voucherType,
      paymentMethod,
      isPosted,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    const where: Prisma.PaymentVoucherWhereInput = {
      ...(supplierId && { supplierId }),
      ...(voucherType && { voucherType }),
      ...(paymentMethod && { paymentMethod }),
      ...(isPosted !== undefined && { isPosted }),
      ...(search && {
        OR: [
          { voucherCode: { contains: search } },
          { supplier: { supplierName: { contains: search } } },
          { expenseAccount: { contains: search } },
        ],
      }),
      ...(fromDate &&
        toDate && {
          paymentDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const [vouchers, total] = await Promise.all([
      prisma.paymentVoucher.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              supplierCode: true,
              supplierName: true,
              phone: true,
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
      prisma.paymentVoucher.count({ where }),
    ]);

    return {
      data: vouchers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: number) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
            phone: true,
            email: true,
            address: true,
            taxCode: true,
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

    if (!voucher) {
      throw new NotFoundError('Payment voucher not found');
    }

    return voucher;
  }

  async create(data: CreatePaymentVoucherInput, userId: number) {
    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        throw new NotFoundError('Supplier not found');
      }

      if (supplier.status !== 'active') {
        throw new ValidationError('Supplier must be active');
      }
    }

    if (data.paymentMethod === 'transfer') {
      if (!data.bankName) {
        throw new ValidationError('Bank name is required for transfer payments');
      }
    }

    const voucherCode = await this.generateVoucherCode();

    const voucher = await prisma.paymentVoucher.create({
      data: {
        voucherCode,
        voucherType: data.voucherType,
        supplierId: data.supplierId,
        expenseAccount: data.expenseAccount,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        bankName: data.bankName,
        paymentDate: new Date(data.paymentDate),
        notes: data.notes,
        isPosted: false,
        createdBy: userId,
      },
      include: {
        supplier: true,
        creator: true,
      },
    });

    logActivity('create', userId, 'payment_vouchers', {
      recordId: voucher.id,
      voucherCode: voucher.voucherCode,
      amount: data.amount,
    });

    return voucher;
  }

  async update(id: number, data: UpdatePaymentVoucherInput, userId: number) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundError('Payment voucher not found');
    }

    if (voucher.isPosted) {
      throw new ValidationError('Cannot update posted voucher');
    }

    if (voucher.approvedBy) {
      throw new ValidationError('Cannot update approved voucher');
    }

    // Validate supplier if changed
    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        throw new NotFoundError('Supplier not found');
      }

      if (supplier.status !== 'active') {
        throw new ValidationError('Supplier must be active');
      }
    }

    if (data.paymentMethod === 'transfer') {
      if (!data.bankName && !voucher.bankName) {
        throw new ValidationError('Bank name is required for transfer payments');
      }
    }

    const updatedVoucher = await prisma.paymentVoucher.update({
      where: { id },
      data: {
        ...(data.voucherType && { voucherType: data.voucherType }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
        ...(data.expenseAccount !== undefined && { expenseAccount: data.expenseAccount }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
        ...(data.bankName !== undefined && { bankName: data.bankName }),
        ...(data.paymentDate && { paymentDate: new Date(data.paymentDate) }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        supplier: true,
        creator: true,
      },
    });

    logActivity('update', userId, 'payment_vouchers', {
      recordId: id,
      voucherCode: voucher.voucherCode,
      changes: data,
    });

    return updatedVoucher;
  }

  async approve(id: number, userId: number, data?: ApproveVoucherInput) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
    });


    const start = new Date('2025-12-30T00:00:00+07:00');
    const end   = new Date('2025-12-30T23:59:59+07:00');

    if (!voucher) {
      throw new NotFoundError('Payment voucher not found');
    }

    if (voucher.isPosted) {
      throw new ValidationError('Cannot approve posted voucher');
    }

    if (voucher.approvedBy) {
      throw new ValidationError('Voucher is already approved');
    }


    await prisma.$transaction(async (tx) => {
      const cashFund = await tx.cashFund.findFirst({
        where: {
          fundDate: {
            gte: start,
            lte: end,
          },
        },
      });
      
      if (!cashFund) {
        throw new ValidationError('Chưa mở quỹ cho ngày hôm nay');
      }

      if (cashFund.isLocked) {
        throw new ValidationError('Quỹ đã khóa, không thể chi tiền');
      }
      const amount = Number(voucher.amount)
      const newTotalPayments = Number(cashFund?.totalPayments || 0) + amount
      const newClosingBalance = Number(cashFund?.openingBalance || 0) + Number(cashFund?.totalReceipts || 0) - newTotalPayments;

      if (newClosingBalance < 0) {
        throw new ValidationError('Số dư quỹ không đủ');
      }

      await tx.cashFund.update({
        where:{
          id: cashFund.id
          // id: 1
        },
        data:{
          totalPayments: newTotalPayments,
          closingBalance: newClosingBalance,
          approvedBy: userId
        }
      })

       await prisma.paymentVoucher.update({
        where: { id },
        data: {
          approvedBy: userId,
          approvedAt: new Date(),
          notes: data?.notes ? `${voucher.notes || ''}\n${data.notes}` : voucher.notes,
        },
        include: {
          supplier: true,
          creator: true,
          approver: true,
        },
      });
    })

    logActivity('update', userId, 'payment_vouchers', {
      recordId: id,
      action: 'approve_voucher',
      voucherCode: voucher.voucherCode,
    });
    return {
      message: "Đã duyệt thành công"
    }
  }

  async post(id: number, userId: number, data?: PostVoucherInput) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundError('Payment voucher not found');
    }

    if (voucher.isPosted) {
      throw new ValidationError('Voucher is already posted');
    }

    if (!voucher.approvedBy) {
      throw new ValidationError('Voucher must be approved before posting');
    }

    const updatedVoucher = await prisma.paymentVoucher.update({
      where: { id },
      data: {
        isPosted: true,
        notes: data?.notes ? `${voucher.notes || ''}\n[POSTED] ${data.notes}` : voucher.notes,
      },
      include: {
        supplier: true,
        creator: true,
        approver: true,
      },
    });

    logActivity('update', userId, 'payment_vouchers', {
      recordId: id,
      action: 'post_voucher',
      voucherCode: voucher.voucherCode,
    });

    return updatedVoucher;
  }

  async delete(id: number, userId: number) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundError('Payment voucher not found');
    }

    if (voucher.isPosted) {
      throw new ValidationError('Cannot delete posted voucher');
    }

    if (voucher.approvedBy) {
      throw new ValidationError('Cannot delete approved voucher');
    }

    await prisma.paymentVoucher.delete({
      where: { id },
    });

    logActivity('delete', userId, 'payment_vouchers', {
      recordId: id,
      voucherCode: voucher.voucherCode,
    });

    return { message: 'Payment voucher deleted successfully' };
  }

  async getBySupplier(supplierId: number) {
    const vouchers = await prisma.paymentVoucher.findMany({
      where: { supplierId },
      include: {
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
      orderBy: {
        paymentDate: 'desc',
      },
    });

    return vouchers;
  }

  async getSummary(fromDate?: string, toDate?: string) {
    const where: Prisma.PaymentVoucherWhereInput = {
      isPosted: true,
      ...(fromDate &&
        toDate && {
          paymentDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const vouchers = await prisma.paymentVoucher.findMany({
      where,
      select: {
        voucherType: true,
        paymentMethod: true,
        amount: true,
      },
    });

    const totalAmount = vouchers.reduce((sum, v) => sum + Number(v.amount), 0);

    const byType = vouchers.reduce((acc, v) => {
      acc[v.voucherType] = (acc[v.voucherType] || 0) + Number(v.amount);
      return acc;
    }, {} as Record<string, number>);

    const byMethod = vouchers.reduce((acc, v) => {
      acc[v.paymentMethod] = (acc[v.paymentMethod] || 0) + Number(v.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalVouchers: vouchers.length,
      totalAmount,
      byType,
      byMethod,
    };
  }

  async getExpenseReport(fromDate: string, toDate: string) {
    const vouchers = await prisma.paymentVoucher.findMany({
      where: {
        isPosted: true,
        paymentDate: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
          },
        },
      },
      orderBy: {
        paymentDate: 'desc',
      },
    });

    const summary = {
      totalExpense: vouchers.reduce((sum, v) => sum + Number(v.amount), 0),
      byType: vouchers.reduce((acc, v) => {
        if (!acc[v.voucherType]) {
          acc[v.voucherType] = {
            count: 0,
            amount: 0,
            vouchers: [],
          };
        }
        acc[v.voucherType].count += 1;
        acc[v.voucherType].amount += Number(v.amount);
        acc[v.voucherType].vouchers.push({
          id: v.id,
          voucherCode: v.voucherCode,
          amount: v.amount,
          paymentDate: v.paymentDate,
          supplier: v.supplier,
          expenseAccount: v.expenseAccount,
        });
        return acc;
      }, {} as Record<string, any>),
    };

    return {
      fromDate,
      toDate,
      summary,
      vouchers,
    };
  }
}

export default new PaymentVoucherService();
