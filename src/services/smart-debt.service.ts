import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';

const prisma = new PrismaClient();

// --- INTERFACES ---
interface DebtQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string; // 'paid' | 'unpaid'
  fromDate?: string;
  toDate?: string;
}

interface SyncDebtParams {
  customerId?: number;
  supplierId?: number;
  notes?: string;
  year?: number; // Mặc định là năm hiện tại
  // Cho phép nhập tay các khoản điều chỉnh nếu cần trong tương lai
  adjustmentAmount?: number;
  assignedUserId?: number;
}

interface SendEmailData {
  recipientEmail: string;
  recipientName: string;
  message?: string;
}

class SmartDebtService {

  // =========================================================================
  // 1. GET ALL (Lấy danh sách hiển thị ra bảng)
  // =========================================================================
  async getAll(params: DebtQueryParams) {
    const { page = 1, limit = 20, search, status, fromDate, toDate } = params;
    const skip = (Number(page) - 1) * Number(limit);

    // Build Query
    const where: Prisma.DebtPeriodWhereInput = {};

    // Tìm kiếm đa năng (Mã phiếu, Tên Khách, Tên NCC)
    if (search) {
      where.OR = [
        { periodName: { contains: search } }, // Tìm theo năm
        { debtMaster: { customer: { customerName: { contains: search } } } },
        { debtMaster: { customer: { customerCode: { contains: search } } } },
        { debtMaster: { supplier: { supplierName: { contains: search } } } },
        { debtMaster: { supplier: { supplierCode: { contains: search } } } },
      ];
    }

    // Lọc theo ngày cập nhật (để xem dữ liệu mới nhất)
    if (fromDate || toDate) {
      where.updatedAt = {};
      if (fromDate) where.updatedAt.gte = new Date(fromDate);
      if (toDate) where.updatedAt.lte = new Date(toDate);
    }

    // Query DB
    const [periods, total] = await Promise.all([
      prisma.debtPeriod.findMany({
        where,
        skip,
        take: Number(limit),
        // ✅ SORT: Luôn đưa bản ghi mới cập nhật lên đầu
        orderBy: { updatedAt: 'desc' },
        include: {
          debtMaster: {
            include: {
              customer: true,
              supplier: true,
              assignedUser: true // Lấy người phụ trách
            }
          }
        }
      }),
      prisma.debtPeriod.count({ where }),
    ]);

    // Map dữ liệu & Tính trạng thái "Đã trả hết/Chưa trả hết"
    const mappedData = periods.map(p => {
      const closing = Number(p.closingBalance);

      // ✅ Logic trạng thái mới: <= 0 là Đã trả hết, > 0 là Chưa trả
      // (Có thể tùy chỉnh ngưỡng nhỏ như < 1000đ coi như hết nợ)
      const calculatedStatus = closing <= 1000 ? 'paid' : 'unpaid';

      // Nếu user lọc theo status trên giao diện
      if (status && status !== calculatedStatus) return null;

      return this.mapToDTO(p, calculatedStatus);
    }).filter(Boolean); // Loại bỏ các item null do filter

    return {
      data: mappedData,
      meta: {
        total: status ? mappedData.length : total, // Fix total count nếu có filter JS
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil((status ? mappedData.length : total) / Number(limit))
      }
    };
  }

  // =========================================================================
  // 2. GET BY ID (Chi tiết + Gộp transactions)
  // =========================================================================
  async getById(id: number) {
    const period = await prisma.debtPeriod.findUnique({
      where: { id: Number(id) },
      include: {
        debtMaster: {
          include: { customer: true, supplier: true, assignedUser: true }
        },
        // Include chứng từ đã được link vào kỳ này
        salesOrders: {
          where: { orderStatus: { not: 'cancelled' } },
          select: { id: true, orderCode: true, totalAmount: true, orderDate: true },
          orderBy: { orderDate: 'asc' }
        },
        paymentReceipts: {
          select: { id: true, receiptCode: true, amount: true, receiptDate: true },
          orderBy: { receiptDate: 'asc' }
        },
        purchaseOrders: {
          where: { status: { not: 'cancelled' } },
          select: { id: true, poCode: true, totalAmount: true, orderDate: true },
          orderBy: { orderDate: 'asc' }
        },
        paymentVouchers: {
          select: { id: true, voucherCode: true, amount: true, paymentDate: true },
          orderBy: { paymentDate: 'asc' }
        }
      }
    });

    if (!period) throw new NotFoundError('Không tìm thấy biên bản đối chiếu');

    const calculatedStatus = Number(period.closingBalance) <= 1000 ? 'paid' : 'unpaid';
    return this.mapToDTO(period, calculatedStatus);
  }

  // =========================================================================
  // 3. CORE: SYNC DEBT (Tính toán & Cập nhật tự động)
  // =========================================================================
  // Hàm này thay thế hoàn toàn hàm create cũ. 
  // Nó vừa tạo mới, vừa cập nhật, vừa tính toán lại.
  async syncDebt(data: SyncDebtParams) {
    const { customerId, supplierId, notes, assignedUserId } = data;

    if (!customerId && !supplierId) {
      throw new ValidationError('Phải chọn Khách hàng hoặc Nhà cung cấp');
    }

    const year = data.year || new Date().getFullYear(); // Mặc định năm nay
    const periodName = `${year}`; // Mã kỳ: "2025"

    // Khung thời gian Năm Nay
    const startOfYear = new Date(year, 0, 1); // 01/01/YYYY
    const endOfYear = new Date(year, 11, 31); // 31/12/YYYY

    return await prisma.$transaction(async (tx) => {
      // B1: Tìm hoặc Tạo Master (Sổ cái tổng)
      let master = await tx.debtMaster.findFirst({
        where: {
          customerId: customerId ? Number(customerId) : null,
          supplierId: supplierId ? Number(supplierId) : null
        }
      });

      if (!master) {
        master = await tx.debtMaster.create({
          data: {
            customerId: customerId ? Number(customerId) : null,
            supplierId: supplierId ? Number(supplierId) : null,
            totalDebt: 0
          }
        });
      } else if (assignedUserId) {
        // ✅ CẬP NHẬT: Nếu master đã có, update người phụ trách mới
        await tx.debtMaster.update({
            where: { id: master.id },
            data: { assignedUserId: Number(assignedUserId) }
        });
        // Cập nhật biến master trong memory để lát mapDTO hiển thị đúng ngay
        master.assignedUserId = Number(assignedUserId); 
      }

      // B2: TÍNH NỢ ĐẦU KỲ (OPENING BALANCE)
      // Logic: Tổng Mua (Quá khứ) - Tổng Trả (Quá khứ) tính đến trước ngày 01/01/NămNay
      // Cách này đảm bảo tính đúng nợ lũy kế từ các năm trước chuyển sang
      let openingBalance = 0;

      // B3: TÍNH PHÁT SINH TRONG KỲ
      let transactionsAmount = 0; // Tổng mua/nhập
      let paymentAmount = 0;      // Thanh toán

      // Các khoản này tạm thời chưa có bảng riêng, lấy từ input hoặc query (nếu có bảng Returns)
      let returnAmount = 0;
      let adjustmentAmount = data.adjustmentAmount ? Number(data.adjustmentAmount) : 0;

      if (customerId) {
        // --- Tính Lịch Sử (Đầu Kỳ) ---
        const prevOrders = await tx.salesOrder.aggregate({
          where: { customerId: Number(customerId), orderDate: { lt: startOfYear }, orderStatus: { not: 'cancelled' } },
          _sum: { totalAmount: true }
        });
        const prevPayments = await tx.paymentReceipt.aggregate({
          where: { customerId: Number(customerId), receiptDate: { lt: startOfYear } },
          _sum: { amount: true }
        });
        openingBalance = Number(prevOrders._sum.totalAmount || 0) - Number(prevPayments._sum.amount || 0);

        // --- Tính Hiện Tại (Trong Kỳ) ---
        const currOrders = await tx.salesOrder.aggregate({
          where: { customerId: Number(customerId), orderDate: { gte: startOfYear, lte: endOfYear }, orderStatus: { not: 'cancelled' } },
          _sum: { totalAmount: true }
        });
        const currPayments = await tx.paymentReceipt.aggregate({
          where: { customerId: Number(customerId), receiptDate: { gte: startOfYear, lte: endOfYear } },
          _sum: { amount: true }
        });

        transactionsAmount = Number(currOrders._sum.totalAmount || 0);
        paymentAmount = Number(currPayments._sum.amount || 0);

        // TODO: Query thêm bảng SalesReturn để tính returnAmount ở đây nếu sau này có bảng Trả hàng
      }
      else if (supplierId) {
        // Logic cho Nhà Cung Cấp
        const prevPO = await tx.purchaseOrder.aggregate({
          where: { supplierId: Number(supplierId), orderDate: { lt: startOfYear }, status: { not: 'cancelled' } },
          _sum: { totalAmount: true }
        });
        const prevVouchers = await tx.paymentVoucher.aggregate({
          where: { supplierId: Number(supplierId), paymentDate: { lt: startOfYear } },
          _sum: { amount: true }
        });
        openingBalance = Number(prevPO._sum.totalAmount || 0) - Number(prevVouchers._sum.amount || 0);

        const currPO = await tx.purchaseOrder.aggregate({
          where: { supplierId: Number(supplierId), orderDate: { gte: startOfYear, lte: endOfYear }, status: { not: 'cancelled' } },
          _sum: { totalAmount: true }
        });
        const currVouchers = await tx.paymentVoucher.aggregate({
          where: { supplierId: Number(supplierId), paymentDate: { gte: startOfYear, lte: endOfYear } },
          _sum: { amount: true }
        });

        transactionsAmount = Number(currPO._sum.totalAmount || 0);
        paymentAmount = Number(currVouchers._sum.amount || 0);
      }

      // B4: CÔNG THỨC CHUẨN: Nợ Cuối = Đầu + Mua - (Trả Hàng + Điều Chỉnh + Thanh Toán)
      const totalDecrease = returnAmount + adjustmentAmount + paymentAmount;
      const closingBalance = openingBalance + transactionsAmount - totalDecrease;

      // B5: UPSERT Bảng DebtPeriod (Lưu kết quả)
      const period = await tx.debtPeriod.upsert({
        where: {
          debtMasterId_periodName: { debtMasterId: master.id, periodName: periodName }
        },
        update: {
          openingBalance,
          increasingAmount: transactionsAmount,
          decreasingAmount: paymentAmount,
          returnAmount,
          adjustmentAmount,
          closingBalance,
          notes: notes !== undefined ? notes : undefined, // Chỉ update nếu có truyền
          updatedAt: new Date(),
        },
        create: {
          debtMasterId: master.id,
          periodName,
          startTime: startOfYear,
          endTime: endOfYear,
          openingBalance,
          increasingAmount: transactionsAmount,
          decreasingAmount: paymentAmount,
          returnAmount,
          adjustmentAmount,
          closingBalance,
          notes: notes || '',
          status: 'OPEN'
        }
      });

      // B6: Cập nhật Master (Tổng nợ hiện tại)
      await tx.debtMaster.update({
        where: { id: master.id },
        data: { totalDebt: closingBalance }
      });

      // B7: Auto-Link (Gắn ID kỳ vào các đơn hàng để dễ truy xuất sau này)
      if (customerId) {
        await tx.salesOrder.updateMany({
          where: { customerId: Number(customerId), orderDate: { gte: startOfYear, lte: endOfYear } },
          data: { debtPeriodId: period.id }
        });
        await tx.paymentReceipt.updateMany({
          where: { customerId: Number(customerId), receiptDate: { gte: startOfYear, lte: endOfYear } },
          data: { debtPeriodId: period.id }
        });
      } else if (supplierId) {
        await tx.purchaseOrder.updateMany({
          where: { supplierId: Number(supplierId), orderDate: { gte: startOfYear, lte: endOfYear } },
          data: { debtPeriodId: period.id }
        });
        await tx.paymentVoucher.updateMany({
          where: { supplierId: Number(supplierId), paymentDate: { gte: startOfYear, lte: endOfYear } },
          data: { debtPeriodId: period.id }
        });
      }

      const status = closingBalance <= 1000 ? 'paid' : 'unpaid';
      return this.mapToDTO({ ...period, debtMaster: master }, status);
    });
  }

  // =========================================================================
  // 4. NEW FEATURE: KIỂM TRA SAI SÓT (DATA INTEGRITY CHECK)
  // =========================================================================
  // Hàm này dùng để Admin kiểm tra xem có kỳ nào bị lệch số liệu không
  async checkDataIntegrity(year: number) {
    const currentPeriods = await prisma.debtPeriod.findMany({
      where: { periodName: `${year}` },
      include: { debtMaster: { include: { customer: true, supplier: true } } }
    });

    const discrepancies = [];

    for (const curr of currentPeriods) {
      // Kiểm tra logic nội bộ: Đầu + Tăng - Giảm == Cuối ?
      const calcClosing = Number(curr.openingBalance) + Number(curr.increasingAmount) -
        (Number(curr.decreasingAmount) + Number(curr.returnAmount) + Number(curr.adjustmentAmount));

      // Cho phép sai số nhỏ do làm tròn số học (< 10 đồng)
      if (Math.abs(calcClosing - Number(curr.closingBalance)) > 10) {
        discrepancies.push({
          masterId: curr.debtMasterId,
          customerName: curr.debtMaster.customer?.customerName || curr.debtMaster.supplier?.supplierName,
          reason: `Sai lệch công thức nội bộ năm ${year}`,
          details: `Tính toán: ${calcClosing} != Lưu trữ: ${curr.closingBalance}`,
          severity: 'CRITICAL'
        });
      }
    }

    return {
      totalChecked: currentPeriods.length,
      discrepanciesCount: discrepancies.length,
      discrepancies
    };
  }

  // =========================================================================
  // 5. SEND EMAIL (Tính năng gửi thông báo)
  // =========================================================================
  async sendEmail(id: number, emailData: SendEmailData, userId: number) {
    // 1. Kiểm tra tồn tại
    const period = await prisma.debtPeriod.findUnique({
      where: { id: Number(id) },
      include: { debtMaster: true } // Lấy thêm master để biết khách nào
    });

    if (!period) throw new NotFoundError('Biên bản không tồn tại');

    // 2. Logic gửi email (Thực tế bạn sẽ gọi EmailService/Nodemailer ở đây)
    // Ví dụ: await emailService.send({ to: emailData.recipientEmail, subject: '...', html: '...' });

    console.log(`📧 [MOCK EMAIL] Sending to ${emailData.recipientEmail}:`, emailData.message);

    // 3. Ghi log hành động
    // Lưu ý: Đảm bảo project bạn có hàm logActivity, nếu không có thể bỏ dòng này
    try {
      await logActivity(
        'EMAIL',
        userId,
        'DebtPeriod',
        `Gửi email đối chiếu kỳ ${period.periodName} cho ${emailData.recipientName}`
      );
    } catch (e) {
      console.warn("Log activity failed:", e);
    }

    return {
      success: true,
      message: `Đã gửi email thành công tới ${emailData.recipientEmail}`
    };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private mapToDTO(period: any, computedStatus: string) {
    const master = period.debtMaster || {};
    const target = master.customer || master.supplier || {};

    // Gộp transactions cho FE (nếu có include)
    let transactions: any[] = [];
    if (period.salesOrders) {
      transactions = transactions.concat(period.salesOrders.map((x: any) => ({
        id: x.id, date: x.orderDate, code: x.orderCode,
        type: 'INVOICE', typeLabel: 'Hóa đơn bán',
        amount: Number(x.totalAmount), isIncrease: true
      })));
    }
    if (period.paymentReceipts) {
      transactions = transactions.concat(period.paymentReceipts.map((x: any) => ({
        id: x.id, date: x.receiptDate, code: x.receiptCode,
        type: 'PAYMENT', typeLabel: 'Phiếu thu',
        amount: Number(x.amount), isIncrease: false
      })));
    }
    if (period.purchaseOrders) {
      transactions = transactions.concat(period.purchaseOrders.map((x: any) => ({
        id: x.id, date: x.orderDate, code: x.poCode,
        type: 'INVOICE', typeLabel: 'Hóa đơn nhập',
        amount: Number(x.totalAmount), isIncrease: true
      })));
    }
    if (period.paymentVouchers) {
      transactions = transactions.concat(period.paymentVouchers.map((x: any) => ({
        id: x.id, date: x.paymentDate, code: x.voucherCode,
        type: 'PAYMENT', typeLabel: 'Phiếu chi',
        amount: Number(x.amount), isIncrease: false
      })));
    }

    // Sort theo ngày
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      id: period.id,
      reconciliationCode: `CN-${period.periodName}-${target.customerCode || target.supplierCode || 'UNK'}`,
      period: period.periodName, // "2025"

      // Thông tin đối tượng
      customer: master.customer,
      supplier: master.supplier,
      assignedUser: master.assignedUser,

      // Số liệu chi tiết
      openingBalance: Number(period.openingBalance),
      transactionsAmount: Number(period.increasingAmount),
      paymentAmount: Number(period.decreasingAmount),

      // ✅ 2 Trường Mới
      returnAmount: Number(period.returnAmount || 0),
      adjustmentAmount: Number(period.adjustmentAmount || 0),

      closingBalance: Number(period.closingBalance),

      // Trạng thái & Meta
      status: computedStatus, // 'paid' | 'unpaid'
      updatedAt: period.updatedAt || period.endTime,
      notes: period.notes,

      transactions: transactions
    };
  }
}

export default new SmartDebtService();