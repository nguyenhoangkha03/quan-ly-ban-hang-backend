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
import RedisService from './redis.service';
import { sortedQuery } from '@utils/redis';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const PAYMENT_VOUCHER_CACHE_TTL = 3600;
const PAYMENT_VOUCHER_LIST_CACHE_TTL = 600;

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

  async getAll(query: PaymentVoucherQueryInput) {
    const {
      page = '1',
      limit = '20',
      search,
      supplierId,
      voucherType,
      paymentMethod,
      isPosted,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Cache key
    const cacheKey = `payment-voucher:list:${JSON.stringify(sortedQuery(query))}`;

    const cache = await redis.get(cacheKey);
    if (cache) {
      console.log(`✅ Cache tìm thấy: ${cacheKey}`);
      return cache;
    }

    console.log(`⚠️ Không có cache: ${cacheKey}, đang truy vấn từ database...`);

    const where: Prisma.PaymentVoucherWhereInput = {
      deletedAt: null,
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
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.paymentVoucher.count({ where }),
    ]);

    // Stat Cards
    const allVouchers = await prisma.paymentVoucher.findMany({
      where,
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        approvedBy: true,
        isPosted: true,
      },
    });

    const totalAmount = allVouchers.reduce((sum, v) => sum + Number(v.amount), 0);
    const cashAmount = allVouchers
      .filter((v) => v.paymentMethod === 'cash')
      .reduce((sum, v) => sum + Number(v.amount), 0);
    const transferAmount = allVouchers
      .filter((v) => v.paymentMethod === 'transfer')
      .reduce((sum, v) => sum + Number(v.amount), 0);

    const approvedVouchers = allVouchers.filter((v) => v.approvedBy).length;
    const pendingVouchers = allVouchers.filter((v) => !v.approvedBy).length;
    const postedVouchers = allVouchers.filter((v) => v.isPosted).length;

    const pendingAmount = allVouchers
      .filter((v) => !v.approvedBy)
      .reduce((sum, v) => sum + Number(v.amount), 0);

    const statistics = {
      totalVouchers: allVouchers.length,
      totalAmount,
      cashAmount,
      transferAmount,
      approvedVouchers,
      pendingVouchers,
      pendingAmount,
      postedVouchers,
    };

    const result = {
      data: vouchers,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      statistics,
    };

    await redis.set(cacheKey, result, PAYMENT_VOUCHER_LIST_CACHE_TTL);

    return result;
  }

  async getById(id: number) {
    const cacheKey = `payment-voucher:${id}`;

    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`✅ Cache tìm thấy: ${cacheKey}`);
      return cached;
    }

    console.log(`⚠️ Không có cache: ${cacheKey}, đang truy vấn từ database...`);

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
      throw new NotFoundError('Phiếu chi không tìm thấy');
    }

    await redis.set(cacheKey, voucher, PAYMENT_VOUCHER_CACHE_TTL);

    return voucher;
  }

  async create(data: CreatePaymentVoucherInput, userId: number) {
    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        throw new NotFoundError('Nhà cung cấp không tìm thấy');
      }

      if (supplier.status !== 'active') {
        throw new ValidationError('Nhà cung cấp phải ở trạng thái hoạt động');
      }
    }

    if (data.paymentMethod === 'transfer') {
      if (!data.bankName) {
        throw new ValidationError('Tên ngân hàng là bắt buộc đối với thanh toán chuyển khoản');
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

    await redis.flushPattern('payment-voucher:list:*');

    return voucher;
  }

  async update(id: number, data: UpdatePaymentVoucherInput, userId: number) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundError('Phiếu chi không tìm thấy');
    }

    if (voucher.isPosted) {
      throw new ValidationError('Không thể cập nhật phiếu chi đã ghi sổ');
    }

    if (voucher.approvedBy) {
      throw new ValidationError('Không thể cập nhật phiếu chi đã được duyệt');
    }

    // Validate supplier if changed
    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        throw new NotFoundError('Nhà cung cấp không tìm thấy');
      }

      if (supplier.status !== 'active') {
        throw new ValidationError('Nhà cung cấp phải ở trạng thái hoạt động');
      }
    }

    if (data.paymentMethod === 'transfer') {
      if (!data.bankName && !voucher.bankName) {
        throw new ValidationError('Tên ngân hàng là bắt buộc đối với thanh toán chuyển khoản');
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

    await redis.del(`payment-voucher:${id}`);
    await redis.flushPattern('payment-voucher:list:*');

    return updatedVoucher;
  }

  async approve(id: number, userId: number, data?: ApproveVoucherInput) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
    });

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    if (!voucher) {
      throw new NotFoundError('Phiếu chi không tìm thấy');
    }

    if (voucher.isPosted) {
      throw new ValidationError('Không thể duyệt phiếu chi đã ghi sổ');
    }

    if (voucher.approvedBy) {
      throw new ValidationError('Phiếu chi đã được duyệt rồi');
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
      const amount = Number(voucher.amount);
      const newTotalPayments = Number(cashFund?.totalPayments || 0) + amount;
      const newClosingBalance =
        Number(cashFund?.openingBalance || 0) +
        Number(cashFund?.totalReceipts || 0) -
        newTotalPayments;

      if (newClosingBalance < 0) {
        throw new ValidationError('Số dư quỹ không đủ');
      }

      await tx.cashFund.update({
        where: {
          id: cashFund.id,
          // id: 1
        },
        data: {
          totalPayments: newTotalPayments,
          closingBalance: newClosingBalance,
        },
      });
    });

    const updatedPayment = await prisma.paymentVoucher.update({
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

    logActivity('update', userId, 'payment_vouchers', {
      recordId: id,
      action: 'approve_voucher',
      voucherCode: voucher.voucherCode,
    });

    await redis.del(`payment-voucher:${id}`);
    await redis.flushPattern('payment-voucher:list:*');

    return updatedPayment;
  }

  async post(id: number, userId: number, data?: PostVoucherInput) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundError('Phiếu chi không tìm thấy');
    }

    if (voucher.isPosted) {
      throw new ValidationError('Phiếu chi đã ghi sổ rồi');
    }

    if (!voucher.approvedBy) {
      throw new ValidationError('Phiếu chi phải được duyệt trước khi ghi sổ');
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

    await redis.del(`payment-voucher:${id}`);
    await redis.flushPattern('payment-voucher:list:*');

    return updatedVoucher;
  }

  async delete(id: number, userId: number) {
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundError('Phiếu chi không tìm thấy');
    }

    if (voucher.isPosted) {
      throw new ValidationError('Không thể xóa phiếu chi đã ghi sổ');
    }

    if (voucher.approvedBy) {
      throw new ValidationError('Không thể xóa phiếu chi đã được duyệt');
    }

    // soft delete
    await prisma.paymentVoucher.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    logActivity('delete', userId, 'payment_vouchers', {
      recordId: id,
      voucherCode: voucher.voucherCode,
    });

    await redis.del(`payment-voucher:${id}`);
    await redis.flushPattern('payment-voucher:list:*');

    return { message: 'Xóa phiếu chi thành công' };
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

  async getStatistics(fromDate?: string, toDate?: string) {
    const where: Prisma.PaymentVoucherWhereInput = {
      ...(fromDate &&
        toDate && {
          paymentDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    // Get all vouchers in period (including pending and unposted)
    const vouchers = await prisma.paymentVoucher.findMany({
      where,
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        approvedBy: true,
        isPosted: true,
      },
    });

    const totalAmount = vouchers.reduce((sum, v) => sum + Number(v.amount), 0);
    const cashAmount = vouchers
      .filter((v) => v.paymentMethod === 'cash')
      .reduce((sum, v) => sum + Number(v.amount), 0);
    const transferAmount = vouchers
      .filter((v) => v.paymentMethod === 'transfer')
      .reduce((sum, v) => sum + Number(v.amount), 0);

    const approvedVouchers = vouchers.filter((v) => v.approvedBy).length;
    const pendingVouchers = vouchers.filter((v) => !v.approvedBy).length;
    const postedVouchers = vouchers.filter((v) => v.isPosted).length;

    const pendingAmount = vouchers
      .filter((v) => !v.approvedBy)
      .reduce((sum, v) => sum + Number(v.amount), 0);

    return {
      totalVouchers: vouchers.length,
      totalAmount,
      cashAmount,
      transferAmount,
      approvedVouchers,
      pendingVouchers,
      pendingAmount,
      postedVouchers,
    };
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
