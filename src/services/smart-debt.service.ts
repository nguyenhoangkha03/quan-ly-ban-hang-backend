import { PrismaClient, Prisma, DebtMaster } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';

const prisma = new PrismaClient();

// --- INTERFACES ---
interface DebtQueryParams {
  year?: number;
  page?: number;
  limit?: number;
  search?: string;
  status?: string; // 'paid' | 'unpaid'
  fromDate?: string;
  toDate?: string;
  assignedUserId?: number;
  province?: string;
  type?: 'customer' | 'supplier';
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
  // Lấy danh sách tổng quan theo Khách hàng / NCC (Master View)
  // Lấy danh sách tổng quan (Master View) nhưng kèm số liệu chi tiết của Kỳ (Period)
  // Lấy danh sách Master View (Dựa trên Kỳ mới nhất của từng khách)
  async getAll(params: DebtQueryParams) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      year,
      assignedUserId,
      province,
      type
    } = params;

    const skip = (Number(page) - 1) * Number(limit);
    const targetYearStr = year ? String(year) : undefined;

    // 1. Build Query Condition (Master) - GIỮ NGUYÊN
    const where: Prisma.DebtMasterWhereInput = {};

    if (search) {
      where.OR = [
        { customer: { customerName: { contains: search } } },
        { customer: { customerCode: { contains: search } } },
        { supplier: { supplierName: { contains: search } } },
        { supplier: { supplierCode: { contains: search } } },
      ];
    }

    if (assignedUserId) where.assignedUserId = Number(assignedUserId);

    if (type === 'customer') where.customerId = { not: null };
    else if (type === 'supplier') where.supplierId = { not: null };

    if (province) {
      where.customer = { province: { contains: province } };
    }

    // Lọc năm (Strict)
    if (targetYearStr) {
      where.periods = { some: { periodName: targetYearStr } };
    }

    // =========================================================================
    // 🔴 BƯỚC MỚI: TÍNH TỔNG TOÀN BỘ (GLOBAL SUMMARY)
    // =========================================================================
    let globalSummary = {
      opening: 0, increase: 0, returnAmt: 0, adjust: 0, payment: 0, closing: 0
    };

    // Chỉ tính tổng khi có chọn Năm (Để số liệu chính xác cho kỳ đó)
    if (targetYearStr) {
      const agg = await prisma.debtPeriod.aggregate({
        _sum: {
          openingBalance: true,
          increasingAmount: true,
          returnAmount: true,
          adjustmentAmount: true,
          decreasingAmount: true,
          closingBalance: true,
        },
        where: {
          periodName: targetYearStr, // Chỉ cộng tiền của năm được chọn
          debtMaster: where          // Áp dụng các bộ lọc Master (Tỉnh, Search, User...)
        }
      });

      globalSummary = {
        opening: Number(agg._sum.openingBalance || 0),
        increase: Number(agg._sum.increasingAmount || 0),
        returnAmt: Number(agg._sum.returnAmount || 0),
        adjust: Number(agg._sum.adjustmentAmount || 0),
        payment: Number(agg._sum.decreasingAmount || 0),
        closing: Number(agg._sum.closingBalance || 0),
      };
    }

    // =========================================================================
    // 2. Query Data List (Phân trang) - GIỮ NGUYÊN
    // =========================================================================
    const [masters, total] = await Promise.all([
      prisma.debtMaster.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: true,
          supplier: true,
          assignedUser: true,
          periods: {
            where: targetYearStr ? { periodName: targetYearStr } : undefined,
            orderBy: { periodName: 'desc' },
            take: 1
          }
        }
      }),
      prisma.debtMaster.count({ where }),
    ]);

    // 3. Transform Data
    const mappedData = masters.map(m => {
      const period = m.periods[0];
      if (!period) return null; // Hoặc trả object rỗng tùy logic cũ của bạn

      const closing = Number(period.closingBalance);
      const currentStatus = closing > 1000 ? 'unpaid' : 'paid';

      // Filter status bằng JS (Lưu ý: Cái này chỉ filter trên trang hiện tại)
      if (status && status !== currentStatus) return null;

      return {
        id: m.id,
        customerId: m.customerId,
        customer: m.customer,
        supplierId: m.supplierId,
        supplier: m.supplier,
        assignedUser: m.assignedUser,
        periodName: period.periodName,
        openingBalance: Number(period.openingBalance),
        increasingAmount: Number(period.increasingAmount),
        decreasingAmount: Number(period.decreasingAmount),
        returnAmount: Number(period.returnAmount),
        adjustmentAmount: Number(period.adjustmentAmount),
        closingBalance: closing,
        status: currentStatus,
        updatedAt: period.updatedAt
      };
    }).filter(Boolean); // Loại bỏ null

    return {
      data: mappedData,
      meta: {
        total: status ? mappedData.length : total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),

        // ✅ TRẢ VỀ SUMMARY CHO FRONTEND
        summary: globalSummary
      }
    };
  }

  // =========================================================================
  // 2. GET BY ID (Chi tiết + Gộp transactions)
  // =========================================================================
  // ✅ Sửa lại logic lấy chi tiết: Nhận vào MasterID và Năm
  async getDetail(masterId: number, year?: number) {
    const targetYear = year ? String(year) : new Date().getFullYear().toString();

    // 1. Lấy thông tin Master (Chủ nợ/Khách hàng)
    const master = await prisma.debtMaster.findUnique({
      where: { id: Number(masterId) },
      include: {
        customer: true,
        supplier: true,
        assignedUser: true,
      }
    });

    if (!master) throw new NotFoundError('Không tìm thấy hồ sơ công nợ này.');

    // 2. Lấy thông tin Kỳ (Period) của năm được chọn
    const period = await prisma.debtPeriod.findFirst({
      where: {
        debtMasterId: Number(masterId),
        periodName: targetYear
      },
      include: {
        // --- CHỨNG TỪ LIÊN QUAN ---
        // 2.1. Hóa đơn bán hàng
        salesOrders: {
          where: { orderStatus: { not: 'cancelled' } },
          select: {
            id: true,
            orderCode: true,
            totalAmount: true,
            orderDate: true,
            orderStatus: true, // ✅ SỬA: status -> orderStatus
            // ✅ SỬA: items -> details (theo schema)
            details: {
              select: { // Dùng select lồng để tối ưu performance thay vì include all
                quantity: true,
                unitPrice: true,
                product: {
                  select: {
                    id: true,
                    productName: true,
                    sku: true
                  }
                }
              }
            }
          },
          orderBy: { orderDate: 'desc' }
        },

        // 2.2. Phiếu thu
        paymentReceipts: {
          // ✅ SỬA: note -> notes
          select: { id: true, receiptCode: true, amount: true, receiptDate: true, notes: true },
          orderBy: { receiptDate: 'desc' }
        },

        // 2.3. Đơn mua hàng (Nếu là NCC)
        purchaseOrders: {
          where: { status: { not: 'cancelled' } },
          select: {
            id: true,
            poCode: true,
            totalAmount: true,
            orderDate: true,
            // ✅ SỬA: items -> details
            details: { include: { product: true } }
          },
          orderBy: { orderDate: 'desc' }
        },

        // 2.4. Phiếu chi
        paymentVouchers: {
          select: { id: true, voucherCode: true, amount: true, paymentDate: true },
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    // 3. Xử lý dữ liệu trả về (Fallback nếu chưa có kỳ của năm nay)
    const baseData = {
      masterId: master.id,
      // Thông tin đối tượng (để hiển thị header đẹp)
      info: {
        name: master.customer?.customerName || master.supplier?.supplierName,
        code: master.customer?.customerCode || master.supplier?.supplierCode,
        phone: master.customer?.phone || master.supplier?.phone,
        address: master.customer?.address,
        province: master.customer?.province,
        district: master.customer?.district,
        email: master.customer?.email,
        type: master.customerId ? 'customer' : 'supplier'
      },
      assignedUser: master.assignedUser,
      periodName: targetYear,
    };

    if (!period) {
      return {
        ...baseData,
        hasData: false,
        financials: { opening: 0, increase: 0, return: 0, payment: 0, adjustment: 0, closing: 0 },
        history: { orders: [], payments: [], products: [] }
      };
    }

    // 4. Tổng hợp danh sách sản phẩm (Flatten Data)
    let productHistory: any[] = [];

    // Xử lý Sales Order (Bán hàng)
    if (period.salesOrders) {
      period.salesOrders.forEach((order: any) => {
        // ✅ SỬA: Dùng order.details thay vì order.items
        if (order.details) {
          order.details.forEach((item: any) => {
            productHistory.push({
              productId: item.productId,
              productName: item.product?.productName || "SP đã xóa", // ✅ SỬA: productName
              sku: item.product?.sku,
              quantity: Number(item.quantity),
              price: Number(item.unitPrice),
              date: order.orderDate,
              orderCode: order.orderCode
            });
          });
        }
      });
    }

    // Xử lý Purchase Order (Mua hàng - Nếu là NCC)
    if (period.purchaseOrders) {
      period.purchaseOrders.forEach((order: any) => {
        if (order.details) {
          order.details.forEach((item: any) => {
            productHistory.push({
              productId: item.productId,
              productName: item.product?.productName || "SP đã xóa",
              sku: item.product?.sku,
              quantity: Number(item.quantity),
              price: Number(item.unitPrice),
              date: order.orderDate,
              orderCode: order.poCode
            });
          });
        }
      });
    }

    return {
      ...baseData,
      id: period.id,
      hasData: true,
      financials: {
        opening: Number(period.openingBalance),
        increase: Number(period.increasingAmount),
        return: Number(period.returnAmount),
        adjustment: Number(period.adjustmentAmount),
        payment: Number(period.decreasingAmount),
        closing: Number(period.closingBalance),
        status: Number(period.closingBalance) > 1000 ? 'unpaid' : 'paid'
      },
      history: {
        orders: period.salesOrders.length > 0 ? period.salesOrders : period.purchaseOrders,
        payments: period.paymentReceipts.length > 0 ? period.paymentReceipts : period.paymentVouchers,
        products: productHistory
      },
      updatedAt: period.updatedAt
    };
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


  /**
 * HÀM SYNC FULL: Quét sạch từ quá khứ đến hiện tại
 * - Đảm bảo không bỏ sót kỳ nào.
 * - Gắn ID kỳ cho tất cả hóa đơn cũ (fix lỗi mồ côi).
 */
  async syncFull(data: SyncDebtParams) {
    const { customerId, supplierId, notes, assignedUserId } = data;

    if (!customerId && !supplierId) {
      throw new ValidationError('Phải chọn Khách hàng hoặc Nhà cung cấp');
    }

    const targetYear = data.year || new Date().getFullYear();

    // Sử dụng Transaction với Timeout lớn (2 phút) để xử lý dữ liệu lịch sử
    return await prisma.$transaction(async (tx) => {
      // 1. Khởi tạo hoặc Lấy Master (Sổ cái)
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
        // Cập nhật người phụ trách (chỉ làm 1 lần ở master)
        master = await tx.debtMaster.update({
          where: { id: master.id },
          data: { assignedUserId: Number(assignedUserId) }
        });
      }

      // 2. TÌM NĂM BẮT ĐẦU (The Beginning of Time)
      // Quét xem đơn hàng đầu tiên của khách này là năm nào
      let startYear = targetYear; // Mặc định là năm nay

      if (customerId) {
        const firstOrder = await tx.salesOrder.findFirst({
          where: { customerId: Number(customerId) },
          orderBy: { orderDate: 'asc' },
          select: { orderDate: true }
        });
        if (firstOrder) startYear = firstOrder.orderDate.getFullYear();
      } else if (supplierId) {
        const firstPO = await tx.purchaseOrder.findFirst({
          where: { supplierId: Number(supplierId) },
          orderBy: { orderDate: 'asc' },
          select: { orderDate: true }
        });
        if (firstPO) startYear = firstPO.orderDate.getFullYear();
      }

      // Nếu startYear > targetYear (Dữ liệu tương lai??), fallback về targetYear
      if (startYear > targetYear) startYear = targetYear;

      console.log(`🔄 [SyncFull] Đang đồng bộ từ năm ${startYear} đến ${targetYear}...`);

      let finalResult = null;

      // 3. VÒNG LẶP THỜI GIAN (Time Loop)
      // Chạy từ quá khứ -> hiện tại để lấp đầy các kỳ còn thiếu
      for (let y = startYear; y <= targetYear; y++) {
        const isTargetYear = y === targetYear;
        // Ghi chú chỉ áp dụng cho năm mục tiêu, các năm cũ để trống hoặc ghi "Auto sync"
        const currentNotes = isTargetYear ? notes : "Đồng bộ tự động lịch sử";

        // Gọi hàm xử lý từng năm (được tách ra bên dưới)
        finalResult = await this._processSinglePeriod(tx, master, y, Number(customerId), Number(supplierId), currentNotes);
      }

      return finalResult; // Trả về kết quả của năm cuối cùng (targetYear)
    }, {
      maxWait: 10000, // Thời gian chờ tối đa để có connection
      timeout: 120000 // ✅ QUAN TRỌNG: Cho phép transaction chạy tối đa 120 giây (2 phút)
    });
  }

  /**
     * HÀM SYNC SNAP: "Chiếc xe đua" - Nhanh và Nhẹ
     * - Chỉ tính toán cho năm được chỉ định.
     * - Lấy số dư cuối của năm trước làm đầu kỳ năm nay.
     */
  async syncSnap(data: SyncDebtParams) {
    const { customerId, supplierId, notes, assignedUserId } = data;

    if (!customerId && !supplierId) {
      throw new ValidationError('Phải chọn Khách hàng hoặc Nhà cung cấp');
    }

    const year = data.year || new Date().getFullYear();
    const periodName = `${year}`;
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    return await prisma.$transaction(async (tx) => {
      // 1. Lấy Master (Sổ cái)
      let master = await tx.debtMaster.findFirst({
        where: {
          customerId: customerId ? Number(customerId) : null,
          supplierId: supplierId ? Number(supplierId) : null
        }
      });

      // Nếu chưa có Master -> Buộc phải tạo (Logic giống SyncFull)
      if (!master) {
        master = await tx.debtMaster.create({
          data: {
            customerId: customerId ? Number(customerId) : null,
            supplierId: supplierId ? Number(supplierId) : null,
            totalDebt: 0
          }
        });
      } else if (assignedUserId) {
        // Cập nhật người phụ trách nếu cần
        master = await tx.debtMaster.update({
          where: { id: master.id },
          data: { assignedUserId: Number(assignedUserId) }
        });
      }

      // 2. TÍNH NỢ ĐẦU KỲ (Logic Kế Thừa - SNAPSHOT)
      let openingBalance = 0;
      let calculationMethod = 'SNAPSHOT'; // Đánh dấu phương pháp tính để debug

      // Tìm kỳ của năm trước (Year - 1)
      const prevPeriod = await tx.debtPeriod.findFirst({
        where: {
          debtMasterId: master.id,
          periodName: `${year - 1}`
        }
      });

      if (prevPeriod) {
        // ✅ TRƯỜNG HỢP LÝ TƯỞNG: Có kỳ trước -> Kế thừa ngay lập tức
        openingBalance = Number(prevPeriod.closingBalance);
      } else {
        // ⚠️ TRƯỜNG HỢP DỰ PHÒNG: Không thấy kỳ trước
        // Fallback về cách tính tổng lịch sử (giống SyncFull) để đảm bảo không bị sai số liệu
        // Tuy nhiên, ta KHÔNG chạy vòng lặp tạo lại các năm cũ (để giữ tốc độ cho hàm này)
        calculationMethod = 'AGGREGATE_FALLBACK';

        if (customerId) {
          const prevOrders = await tx.salesOrder.aggregate({
            where: { customerId: Number(customerId), orderDate: { lt: startOfYear }, orderStatus: { not: 'cancelled' } },
            _sum: { totalAmount: true }
          });
          const prevPayments = await tx.paymentReceipt.aggregate({
            where: { customerId: Number(customerId), receiptDate: { lt: startOfYear } },
            _sum: { amount: true }
          });
          openingBalance = Number(prevOrders._sum.totalAmount || 0) - Number(prevPayments._sum.amount || 0);
        } else if (supplierId) {
          const prevPO = await tx.purchaseOrder.aggregate({
            where: { supplierId: Number(supplierId), orderDate: { lt: startOfYear }, status: { not: 'cancelled' } },
            _sum: { totalAmount: true }
          });
          const prevVouchers = await tx.paymentVoucher.aggregate({
            where: { supplierId: Number(supplierId), paymentDate: { lt: startOfYear } },
            _sum: { amount: true }
          });
          openingBalance = Number(prevPO._sum.totalAmount || 0) - Number(prevVouchers._sum.amount || 0);
        }
      }

      // 3. TÍNH PHÁT SINH TRONG KỲ (Hiện tại)
      // Phần này giống hệt SyncFull, vì phải quét giao dịch thực tế trong năm nay
      let transactionsAmount = 0;
      let paymentAmount = 0;
      let returnAmount = 0;
      let adjustmentAmount = 0; // Nếu muốn nhận từ params thì thêm vào

      if (customerId) {
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
      } else if (supplierId) {
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

      // 4. CHỐT SỐ
      const totalDecrease = returnAmount + adjustmentAmount + paymentAmount;
      const closingBalance = openingBalance + transactionsAmount - totalDecrease;

      // Ghi chú tự động nếu phải dùng Fallback
      let finalNote = notes || '';
      if (calculationMethod === 'AGGREGATE_FALLBACK') {
        finalNote = finalNote ? `${finalNote} (Tự động tính lại đầu kỳ do thiếu năm trước)` : 'Tự động tính lại đầu kỳ do thiếu năm trước';
      }

      // 5. LƯU DB (Upsert Period)
      const period = await tx.debtPeriod.upsert({
        where: {
          debtMasterId_periodName: { debtMasterId: master.id, periodName: periodName }
        },
        update: {
          openingBalance,
          increasingAmount: transactionsAmount,
          decreasingAmount: paymentAmount,
          closingBalance,
          updatedAt: new Date(),
          ...(notes ? { notes: finalNote } : {})
        },
        create: {
          debtMasterId: master.id,
          periodName,
          startTime: startOfYear,
          endTime: endOfYear,
          openingBalance,
          increasingAmount: transactionsAmount,
          decreasingAmount: paymentAmount,
          closingBalance,
          notes: finalNote,
          status: 'OPEN'
        }
      });

      // 6. CẬP NHẬT MASTER
      await tx.debtMaster.update({
        where: { id: master.id },
        data: { totalDebt: closingBalance }
      });

      // 7. AUTO-LINK (Vẫn cần thiết để xem chi tiết năm nay)
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

  /**
   * HÀM SYNC FULL ALL: "Batch Healer"
   * - Chạy syncFull cho TẤT CẢ khách hàng/NCC có giao dịch trong năm.
   * - Dùng để bảo trì, sửa lỗi diện rộng hoặc chốt sổ định kỳ.
   */
  async syncFullAll(year: number) {
    console.log(`🚀 [Batch Full] Bắt đầu đồng bộ toàn bộ dữ liệu lịch sử cho năm ${year}...`);
    const start = Date.now();

    // 1. Lấy danh sách ID cần chạy (chỉ lấy những người có hoạt động)
    const activeCustomerIds = await this._getActiveCustomerIds(year);
    const activeSupplierIds = await this._getActiveSupplierIds(year);

    const totalTasks = activeCustomerIds.length + activeSupplierIds.length;
    console.log(`📊 Tìm thấy ${activeCustomerIds.length} Khách hàng và ${activeSupplierIds.length} NCC có hoạt động.`);

    let successCount = 0;
    let failCount = 0;
    const errors: any[] = [];

    // 2. Chạy vòng lặp cho KHÁCH HÀNG
    // Lưu ý: Chạy tuần tự (await trong loop) để tránh làm nghẽn Database connection pool
    for (const customerId of activeCustomerIds) {
      try {
        // Gọi lại hàm syncFull (Healer)
        // KHÔNG truyền assignedUserId để giữ nguyên người phụ trách cũ
        await this.syncFull({
          customerId,
          year,
          notes: 'Đồng bộ hệ thống định kỳ (Batch Job)'
        });
        successCount++;
        // (Optional) console.log(` -> Xong Customer ${customerId}`);
      } catch (error: any) {
        failCount++;
        console.error(`❌ Lỗi sync Customer ID ${customerId}:`, error.message);
        errors.push({ type: 'customer', id: customerId, error: error.message });
      }
    }

    // 3. Chạy vòng lặp cho NHÀ CUNG CẤP
    for (const supplierId of activeSupplierIds) {
      try {
        await this.syncFull({
          supplierId,
          year,
          notes: 'Đồng bộ hệ thống định kỳ (Batch Job)'
        });
        successCount++;
      } catch (error: any) {
        failCount++;
        console.error(`❌ Lỗi sync Supplier ID ${supplierId}:`, error.message);
        errors.push({ type: 'supplier', id: supplierId, error: error.message });
      }
    }

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`✅ [Batch Full] Hoàn tất sau ${duration}s. Thành công: ${successCount}, Thất bại: ${failCount}`);

    return {
      year,
      mode: 'FULL_ALL',
      totalChecked: totalTasks,
      success: successCount,
      failed: failCount,
      durationSeconds: duration,
      errors // Trả về danh sách lỗi để hiển thị log
    };
  }

  /**
   * HÀM SYNC SNAP ALL: "Batch Sprinter"
   * - Chạy syncSnap cho TẤT CẢ khách hàng/NCC có hoạt động trong năm.
   * - Dùng để chạy cuối ngày (Cron Job) hoặc nút "Làm mới nhanh toàn bộ".
   */
  async syncSnapAll(year: number) {
    console.log(`⚡ [Batch Snap] Bắt đầu đồng bộ nhanh toàn bộ cho năm ${year}...`);
    const start = Date.now();

    // 1. Lấy danh sách ID (Dùng lại helper đã sửa logic > 0)
    const activeCustomerIds = await this._getActiveCustomerIds(year);
    const activeSupplierIds = await this._getActiveSupplierIds(year);

    const totalTasks = activeCustomerIds.length + activeSupplierIds.length;
    console.log(`📊 Tìm thấy ${totalTasks} đối tượng cần cập nhật nhanh.`);

    let successCount = 0;
    let failCount = 0;
    const errors: any[] = [];

    // 2. Chạy vòng lặp cho KHÁCH HÀNG
    for (const customerId of activeCustomerIds) {
      try {
        // Gọi hàm syncSnap
        await this.syncSnap({
          customerId,
          year,
          // Note tự động để truy vết sau này
          notes: 'Auto-sync: Cập nhật nhanh cuối ngày'
        });
        successCount++;
      } catch (error: any) {
        failCount++;
        // Log lỗi nhưng không dừng chương trình
        console.error(`❌ Lỗi Snap khách ID ${customerId}:`, error.message);
        errors.push({ type: 'customer', id: customerId, error: error.message });
      }
    }

    // 3. Chạy vòng lặp cho NHÀ CUNG CẤP
    for (const supplierId of activeSupplierIds) {
      try {
        await this.syncSnap({
          supplierId,
          year,
          notes: 'Auto-sync: Cập nhật nhanh cuối ngày'
        });
        successCount++;
      } catch (error: any) {
        failCount++;
        console.error(`❌ Lỗi Snap NCC ID ${supplierId}:`, error.message);
        errors.push({ type: 'supplier', id: supplierId, error: error.message });
      }
    }

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`✅ [Batch Snap] Hoàn tất sau ${duration}s. Thành công: ${successCount}/${totalTasks}`);

    return {
      year,
      mode: 'SNAP_ALL',
      totalChecked: totalTasks,
      success: successCount,
      failed: failCount,
      durationSeconds: duration,
      errors
    };
  }

  // =========================================================================
  // 4. DATA INTEGRITY CHECK (THANH TRA DỮ LIỆU) - VERSION 2.0
  // =========================================================================

  /**
   * Hàm kiểm tra sai sót toàn diện
   * - Check 1: Logic toán học nội bộ (Internal Math)
   * - Check 2: Tính nhất quán giữa các năm (Cross-Period Consistency)
   * - Check 3: Phát hiện kỳ bị thiếu (Missing Periods)
   */
  async checkDataIntegrity(year: number) {
    console.log(`🕵️‍♀️ [Check] Bắt đầu kiểm tra dữ liệu năm ${year}...`);

    // 1. Lấy dữ liệu năm hiện tại
    const currentPeriods = await prisma.debtPeriod.findMany({
      where: { periodName: `${year}` },
      include: { debtMaster: { include: { customer: true, supplier: true } } }
    });

    // 2. Lấy dữ liệu năm trước (để so sánh liên kỳ)
    // Tối ưu: Lấy hết 1 lần thay vì query trong vòng lặp (tránh N+1 query problem)
    const prevPeriods = await prisma.debtPeriod.findMany({
      where: { periodName: `${year - 1}` },
      select: { debtMasterId: true, closingBalance: true }
    });

    // Tạo Map để tra cứu năm trước cho nhanh (O(1))
    const prevPeriodMap = new Map();
    prevPeriods.forEach(p => prevPeriodMap.set(p.debtMasterId, Number(p.closingBalance)));

    const discrepancies: any[] = [];
    const checkedMasterIds = new Set<number>();

    // --- VÒNG LẶP KIỂM TRA CHÍNH ---
    for (const curr of currentPeriods) {
      checkedMasterIds.add(curr.debtMasterId);
      const customerName = curr.debtMaster.customer?.customerName || curr.debtMaster.supplier?.supplierName || 'Unknown';
      const masterId = curr.debtMasterId;

      // ---------------------------------------------------------
      // CHECK 1: LOGIC NỘI BỘ (Internal Math)
      // Công thức: Cuối = Đầu + Tăng - Giảm
      // ---------------------------------------------------------
      const calcClosing = Number(curr.openingBalance) + Number(curr.increasingAmount) -
        (Number(curr.decreasingAmount) + Number(curr.returnAmount) + Number(curr.adjustmentAmount));

      if (Math.abs(calcClosing - Number(curr.closingBalance)) > 10) {
        discrepancies.push({
          type: 'INTERNAL_MATH_ERROR',
          masterId,
          customerName,
          reason: `Sai lệch công thức nội bộ năm ${year}`,
          details: `Tính toán (${calcClosing}) != Lưu trữ (${curr.closingBalance})`,
          severity: 'CRITICAL' // Lỗi này do code tính sai hoặc ai đó sửa DB
        });
      }

      // ---------------------------------------------------------
      // CHECK 2: LIÊN KẾT KỲ TRƯỚC (Cross-Period Check)
      // Công thức: Đầu năm nay == Cuối năm ngoái
      // ---------------------------------------------------------
      if (prevPeriodMap.has(masterId)) {
        const prevClosing = prevPeriodMap.get(masterId);
        const currOpening = Number(curr.openingBalance);

        if (Math.abs(prevClosing - currOpening) > 10) {
          discrepancies.push({
            type: 'CROSS_PERIOD_ERROR',
            masterId,
            customerName,
            reason: `Đứt gãy số liệu giữa ${year - 1} và ${year}`,
            details: `Cuối ${year - 1} (${prevClosing}) != Đầu ${year} (${currOpening})`,
            severity: 'HIGH' // Lỗi này do chạy syncSnap mà thiếu syncFull
          });
        }
      }
    }

    // ---------------------------------------------------------
    // CHECK 3: PHÁT HIỆN KỲ BỊ THIẾU (Missing Periods)
    // Khách có giao dịch nhưng chưa tạo bảng công nợ
    // ---------------------------------------------------------
    // Lấy danh sách khách hàng hoạt động thực tế trong năm
    const activeCustomerIds = await this._getActiveCustomerIds(year);
    const activeSupplierIds = await this._getActiveSupplierIds(year);

    // Kiểm tra Khách hàng
    for (const customerId of activeCustomerIds) {
      // Tìm xem khách này có master chưa
      const master = await prisma.debtMaster.findFirst({ where: { customerId } });
      if (!master || !checkedMasterIds.has(master.id)) {
        discrepancies.push({
          type: 'MISSING_DATA',
          masterId: master?.id || null,
          customerName: `Customer ID: ${customerId}`,
          reason: `Có phát sinh giao dịch năm ${year} nhưng chưa có bảng công nợ`,
          details: 'Cần chạy SyncFull hoặc SyncSnap ngay',
          severity: 'MEDIUM'
        });
      }
    }

    // Kiểm tra NCC (Tương tự)
    for (const supplierId of activeSupplierIds) {
      const master = await prisma.debtMaster.findFirst({ where: { supplierId } });
      if (!master || !checkedMasterIds.has(master.id)) {
        discrepancies.push({
          type: 'MISSING_DATA',
          masterId: master?.id || null,
          customerName: `Supplier ID: ${supplierId}`,
          reason: `Có phát sinh giao dịch năm ${year} nhưng chưa có bảng công nợ`,
          details: 'Cần chạy SyncFull hoặc SyncSnap ngay',
          severity: 'MEDIUM'
        });
      }
    }

    return {
      year,
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

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /**
   * HÀM PRIVATE: Xử lý tính toán cho 1 năm cụ thể
   * (Được tách ra từ logic để tái sử dụng trong vòng lặp)
   */
  private async _processSinglePeriod(
    tx: Prisma.TransactionClient, // Định nghĩa Type rõ ràng để tránh lỗi implicit any
    master: DebtMaster,
    year: number,
    customerId?: number | null,
    supplierId?: number | null,
    notes?: string
  ) {
    const periodName = `${year}`;
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // B2: TÍNH NỢ ĐẦU KỲ
    // Logic: Vẫn giữ nguyên cách tính "Sum Lịch Sử" cho SyncFull để đảm bảo chính xác tuyệt đối
    let openingBalance = 0;

    if (customerId) {
      const prevOrders = await tx.salesOrder.aggregate({
        where: { customerId: Number(customerId), orderDate: { lt: startOfYear }, orderStatus: { not: 'cancelled' } },
        _sum: { totalAmount: true }
      });
      const prevPayments = await tx.paymentReceipt.aggregate({
        where: { customerId: Number(customerId), receiptDate: { lt: startOfYear } },
        _sum: { amount: true }
      });
      openingBalance = Number(prevOrders._sum.totalAmount || 0) - Number(prevPayments._sum.amount || 0);
    } else if (supplierId) {
      const prevPO = await tx.purchaseOrder.aggregate({
        where: { supplierId: Number(supplierId), orderDate: { lt: startOfYear }, status: { not: 'cancelled' } },
        _sum: { totalAmount: true }
      });
      const prevVouchers = await tx.paymentVoucher.aggregate({
        where: { supplierId: Number(supplierId), paymentDate: { lt: startOfYear } },
        _sum: { amount: true }
      });
      openingBalance = Number(prevPO._sum.totalAmount || 0) - Number(prevVouchers._sum.amount || 0);
    }

    // B3: TÍNH PHÁT SINH TRONG KỲ
    let transactionsAmount = 0;
    let paymentAmount = 0;
    let returnAmount = 0;
    let adjustmentAmount = 0;

    if (customerId) {
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
    } else if (supplierId) {
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

    // B4: CHỐT SỐ
    const totalDecrease = returnAmount + adjustmentAmount + paymentAmount;
    const closingBalance = openingBalance + transactionsAmount - totalDecrease;

    // B5: LƯU DB (Upsert)
    const period = await tx.debtPeriod.upsert({
      where: {
        debtMasterId_periodName: { debtMasterId: master.id, periodName: periodName }
      },
      update: {
        openingBalance,
        increasingAmount: transactionsAmount,
        decreasingAmount: paymentAmount,
        closingBalance,
        updatedAt: new Date(),
        ...(notes ? { notes } : {})
      },
      create: {
        debtMasterId: master.id,
        periodName,
        startTime: startOfYear,
        endTime: endOfYear,
        openingBalance,
        increasingAmount: transactionsAmount,
        decreasingAmount: paymentAmount,
        closingBalance,
        notes: notes || '',
        status: 'OPEN'
      }
    });

    // B6: Cập nhật Master (chỉ quan trọng ở vòng lặp cuối, nhưng update luôn cho chắc)
    await tx.debtMaster.update({
      where: { id: master.id },
      data: { totalDebt: closingBalance }
    });

    // B7: AUTO-LINK (QUAN TRỌNG: Gắn ID kỳ vào hóa đơn để hết mồ côi)
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

    // Return logic...
    const status = closingBalance <= 1000 ? 'paid' : 'unpaid';
    return { ...period, debtMaster: master, status }; // Hoặc gọi this.mapToDTO nếu có
  }

  // ==========================================
  // PRIVATE HELPERS (Tìm người có giao dịch)
  // ==========================================

  /**
   * Helper: Tìm tất cả ID Khách hàng có phát sinh Mua hàng HOẶC Trả tiền trong năm
   */
  private async _getActiveCustomerIds(year: number): Promise<number[]> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // 1. Lấy khách có Đơn hàng
    const orderCustomers = await prisma.salesOrder.findMany({
      where: {
        orderDate: { gte: startOfYear, lte: endOfYear },
        orderStatus: { not: 'cancelled' },
        customerId: { gt: 0 } // ✅ Quan trọng: Lọc ID > 0 để tránh null
      },
      select: { customerId: true },
      distinct: ['customerId']
    });

    // 2. Lấy khách có Phiếu thu (Trường hợp không mua mới nhưng trả nợ cũ)
    const paymentCustomers = await prisma.paymentReceipt.findMany({
      where: {
        receiptDate: { gte: startOfYear, lte: endOfYear },
        customerId: { gt: 0 } // ✅ Quan trọng: Lọc ID > 0
      },
      select: { customerId: true },
      distinct: ['customerId']
    });

    // 3. Gộp lại và loại bỏ trùng lặp
    const uniqueIds = new Set([
      ...orderCustomers.map(i => i.customerId),
      ...paymentCustomers.map(i => i.customerId)
    ]);

    // Trả về mảng số, ép kiểu an toàn vì đã lọc gt:0
    return Array.from(uniqueIds) as number[];
  }

  /**
   * Helper: Tìm tất cả ID Nhà cung cấp có hoạt động
   */
  private async _getActiveSupplierIds(year: number): Promise<number[]> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // 1. Lấy NCC có Đơn nhập hàng
    const poSuppliers = await prisma.purchaseOrder.findMany({
      where: {
        orderDate: { gte: startOfYear, lte: endOfYear },
        status: { not: 'cancelled' },
        supplierId: { gt: 0 } // ✅ Quan trọng: Lọc ID > 0
      },
      select: { supplierId: true },
      distinct: ['supplierId']
    });

    // 2. Lấy NCC có Phiếu chi
    const voucherSuppliers = await prisma.paymentVoucher.findMany({
      where: {
        paymentDate: { gte: startOfYear, lte: endOfYear },
        supplierId: { gt: 0 } // ✅ Quan trọng: Lọc ID > 0
      },
      select: { supplierId: true },
      distinct: ['supplierId']
    });

    // 3. Gộp và trả về
    const uniqueIds = new Set([
      ...poSuppliers.map(i => i.supplierId),
      ...voucherSuppliers.map(i => i.supplierId)
    ]);

    return Array.from(uniqueIds) as number[];
  }


  /// Hàm chuyển đổi dữ liệu DB sang DTO cho frontend
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
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


}

export default new SmartDebtService();