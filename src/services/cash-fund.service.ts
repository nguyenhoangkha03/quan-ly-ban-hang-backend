import {
  CashFundCreateInput,
  CashFundFilter,
  CashFundLockInput,
  CashFundUpdateInput,
} from '@custom-types/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CashFundService {
  async getDailyCashFund(date: Date) {
    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    if (!fund) {
      const previousDay = new Date(date);
      previousDay.setDate(previousDay.getDate() - 1);

      const previousFund = await prisma.cashFund.findUnique({
        where: { fundDate: previousDay },
      });

      const previousClosing = previousFund
        ? Number(previousFund.openingBalance) +
          Number(previousFund.totalReceipts) -
          Number(previousFund.totalPayments)
        : 0;
      const openingBalance = previousClosing;

      return await this.createCashFund({
        fundDate: date,
        openingBalance,
        notes: 'Auto-created fund',
      });
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const receipts = await prisma.paymentReceipt.aggregate({
      where: {
        receiptDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        isPosted: true,
      },
      _sum: {
        amount: true,
      },
    });

    const payments = await prisma.paymentVoucher.aggregate({
      where: {
        paymentDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        isPosted: true,
      },
      _sum: {
        amount: true,
      },
    });

    const totalReceipts = Number(receipts._sum.amount || 0);
    const totalPayments = Number(payments._sum.amount || 0);

    if (!fund.isLocked) {
      await prisma.cashFund.update({
        where: { id: fund.id },
        data: {
          totalReceipts,
          totalPayments,
        },
      });
    }

    return {
      ...fund,
      totalReceipts,
      totalPayments,
      closingBalance: Number(fund.openingBalance) + totalReceipts - totalPayments,
    };
  }

  async getCashFundList(filter: CashFundFilter) {
    const where: any = {};

    if (filter.startDate || filter.endDate) {
      where.fundDate = {};
      if (filter.startDate) where.fundDate.gte = filter.startDate;
      if (filter.endDate) where.fundDate.lte = filter.endDate;
    }

    if (filter.isLocked !== undefined) {
      where.isLocked = filter.isLocked;
    }

    const funds = await prisma.cashFund.findMany({
      where,
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
      orderBy: { fundDate: 'desc' },
    });

    return funds;
  }

  async createCashFund(data: CashFundCreateInput) {
    const existing = await prisma.cashFund.findUnique({
      where: { fundDate: data.fundDate },
    });

    if (existing) {
      throw new Error('Quỹ tiền mặt cho ngày này đã tồn tại');
    }

    const fund = await prisma.cashFund.create({
      data: {
        fundDate: data.fundDate,
        openingBalance: data.openingBalance || 0,
        totalReceipts: 0,
        totalPayments: 0,
        notes: data.notes,
      },
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    return fund;
  }

  async updateCashFund(date: Date, data: CashFundUpdateInput) {
    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
    });

    if (!fund) {
      throw new Error('Quỹ tiền mặt không tồn tại');
    }

    if (fund.isLocked) {
      throw new Error('Không thể cập nhật quỹ tiền mặt đã khóa');
    }

    const updated = await prisma.cashFund.update({
      where: { fundDate: date },
      data: {
        openingBalance: data.openingBalance,
        notes: data.notes,
      },
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    return updated;
  }

  async lockCashFund(date: Date, lockData: CashFundLockInput) {
    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
    });

    if (!fund) {
      throw new Error('Quỹ tiền mặt không tồn tại');
    }

    if (fund.isLocked) {
      throw new Error('Quỹ tiền mặt đã được khóa');
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const receipts = await prisma.paymentReceipt.aggregate({
      where: {
        receiptDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        isPosted: true,
      },
      _sum: {
        amount: true,
      },
    });

    const payments = await prisma.paymentVoucher.aggregate({
      where: {
        paymentDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        isPosted: true,
      },
      _sum: {
        amount: true,
      },
    });

    const totalReceipts = Number(receipts._sum.amount || 0);
    const totalPayments = Number(payments._sum.amount || 0);

    const locked = await prisma.cashFund.update({
      where: { fundDate: date },
      data: {
        totalReceipts,
        totalPayments,
        isLocked: true,
        lockedAt: new Date(),
        approvedBy: lockData.approvedBy,
        reconciledBy: lockData.reconciledBy,
        notes: lockData.notes || fund.notes,
      },
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    const closingBalance = Number(locked.openingBalance) + totalReceipts - totalPayments;

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const nextFundExists = await prisma.cashFund.findUnique({
      where: { fundDate: nextDay },
    });

    if (!nextFundExists) {
      await this.createCashFund({
        fundDate: nextDay,
        openingBalance: closingBalance,
        notes: 'Auto-created from previous day',
      });
    }

    return {
      ...locked,
      closingBalance,
    };
  }

  async unlockCashFund(date: Date) {
    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
    });

    if (!fund) {
      throw new Error('Quỹ tiền mặt không tồn tại');
    }

    if (!fund.isLocked) {
      throw new Error('Quỹ tiền mặt chưa được khóa');
    }

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const nextFund = await prisma.cashFund.findUnique({
      where: { fundDate: nextDay },
    });

    if (nextFund?.isLocked) {
      throw new Error('Không thể mở khóa: ngày tiếp theo đã được khóa');
    }

    const unlocked = await prisma.cashFund.update({
      where: { fundDate: date },
      data: {
        isLocked: false,
        lockedAt: null,
        approvedBy: null,
        reconciledBy: null,
      },
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    return unlocked;
  }

  async getCashFundSummary(startDate: Date, endDate: Date) {
    const funds = await prisma.cashFund.findMany({
      where: {
        fundDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { fundDate: 'asc' },
    });

    const summary = {
      totalDays: funds.length,
      lockedDays: funds.filter((f) => f.isLocked).length,
      unlockedDays: funds.filter((f) => !f.isLocked).length,
      totalReceipts: funds.reduce((sum, f) => sum + Number(f.totalReceipts), 0),
      totalPayments: funds.reduce((sum, f) => sum + Number(f.totalPayments), 0),
      openingBalance: Number(funds[0]?.openingBalance || 0),
      closingBalance: 0,
      netChange: 0,
    };

    const lastFund = funds[funds.length - 1];
    if (lastFund) {
      summary.closingBalance =
        Number(lastFund.openingBalance) +
        Number(lastFund.totalReceipts) -
        Number(lastFund.totalPayments);
    }

    summary.netChange = summary.closingBalance - summary.openingBalance;

    return summary;
  }

  async getDiscrepancies(date: Date) {
    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
    });

    if (!fund) {
      throw new Error('Quỹ tiền mặt không tồn tại');
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    // Get all receipts for the day
    const receipts = await prisma.paymentReceipt.findMany({
      where: {
        receiptDate: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      select: {
        id: true,
        receiptCode: true,
        amount: true,
        receiptDate: true,
        isPosted: true,
      },
    });

    const payments = await prisma.paymentVoucher.findMany({
      where: {
        paymentDate: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      select: {
        id: true,
        voucherCode: true,
        amount: true,
        paymentDate: true,
        isPosted: true,
      },
    });

    const totalReceipts = receipts
      .filter((r: any) => r.isPosted)
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

    const totalPayments = payments
      .filter((p: any) => p.isPosted)
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const calculatedClosing = Number(fund.openingBalance) + totalReceipts - totalPayments;
    const recordedClosing =
      Number(fund.openingBalance) + Number(fund.totalReceipts) - Number(fund.totalPayments);

    const discrepancy = calculatedClosing - recordedClosing;

    return {
      fundDate: fund.fundDate,
      openingBalance: Number(fund.openingBalance),
      recordedReceipts: Number(fund.totalReceipts),
      calculatedReceipts: totalReceipts,
      recordedPayments: Number(fund.totalPayments),
      calculatedPayments: totalPayments,
      recordedClosing,
      calculatedClosing,
      discrepancy,
      hasDiscrepancy: Math.abs(discrepancy) > 0.01,
      receipts,
      payments,
    };
  }
}

export default new CashFundService();
