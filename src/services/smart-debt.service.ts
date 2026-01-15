import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
// import { logActivity } from '@utils/logger';

import CacheHelper from '@utils/redis.helper';
import { sortedQuery } from '@utils/cache.util';


const prisma = new PrismaClient();

export interface DebtQueryParams {
  year?: number;          // Mặc định năm hiện tại
  page?: number;
  limit?: number;
  search?: string;        // Tìm tên, sđt, mã...
  status?: 'paid' | 'unpaid'; 
  
  assignedUserId?: number; // Lọc theo nhân viên phụ trách
  province?: string;       // Lọc theo tỉnh (chỉ áp dụng cho KH)
  type?: 'customer' | 'supplier'; 
}

// ==========================================
// 2. SYNC PARAMS (Dùng cho syncFull, syncSnap)
// ==========================================
export interface SyncDebtParams {
  customerId?: number;
  supplierId?: number;
  
  year?: number;          // Năm cần đồng bộ
  notes?: string;         // Ghi chú hệ thống/thủ công
  
  assignedUserId?: number; // Cập nhật người phụ trách (nếu có)
  
  // (Optional) Giữ lại để mở rộng sau này (VD: Nút điều chỉnh số dư tay)
  adjustmentAmount?: number; 
}

// ==========================================
// 3. SEND NOTICE PARAMS (⚠️ CẬP NHẬT LỚN)
// ==========================================
// Interface cũ SendEmailData quá đơn giản, không đủ cho logic mới
export interface SendDebtNoticeParams {
  id: number;                      // ID của Customer hoặc Supplier
  type: 'customer' | 'supplier';   // Loại đối tượng
  
  year?: number;                   // Có year => Gửi biên bản đối chiếu. Không year => Nhắc nợ hiện tại
  
  customEmail?: string;            // Nếu muốn gửi đè tới email khác (VD: email kế toán trưởng)
  message?: string;                // Lời nhắn thêm từ người gửi
  cc?: string[];                   // Danh sách email CC (nếu cần)
}

// ==========================================
// 4. (MỚI) DETAIL PARAMS (Dùng cho getDetail)
// ==========================================
// Giúp Controller validate chặt chẽ hơn
export interface DebtDetailParams {
  id: number;
  type: 'customer' | 'supplier';
  year?: number;
}

class SmartDebtService {
private cache: CacheHelper;

  constructor() {
    this.cache = new CacheHelper();
  }

// =========================================================================
  // 1. GET ALL (ĐÃ FIX LỖI LỌC TỈNH CHO NCC VÀ ALL)
  // =========================================================================
  async getAll(params: DebtQueryParams) {
    const queryHash = JSON.stringify(sortedQuery(params));
    const cachedData = await this.cache.getDebtList(queryHash);
    if (cachedData) return cachedData;

    const { page = 1, limit = 20, search, status, year, assignedUserId, province, type } = params;
    const skip = (Number(page) - 1) * Number(limit);
    const targetYearStr = year ? String(year) : String(new Date().getFullYear());

    let data: any[] = [];
    let total = 0;

    // =========================================================================
    // A. CHIẾN LƯỢC QUERY
    // =========================================================================
    
    // --- 1. LỌC THEO KHÁCH HÀNG (Query bảng Customer) ---
    if (type === 'customer') {
        const where: any = { status: 'active' };

        if (search) {
            where.OR = [
                { customerName: { contains: search } },
                { customerCode: { contains: search } },
                { phone: { contains: search } }
            ];
        }
        // ✅ Khách hàng: Lọc theo cột province
        if (province) where.province = { contains: province };
        
        if (assignedUserId) where.assignedUserId = Number(assignedUserId);
        
        if (status) {
            const debtCondition = { periodName: targetYearStr };
            if (status === 'unpaid') {
                where.debtPeriods = { some: { ...debtCondition, closingBalance: { gt: 1000 } } };
            } else {
                where.OR = [
                    { debtPeriods: { none: { periodName: targetYearStr } } },
                    { debtPeriods: { some: { ...debtCondition, closingBalance: { lte: 1000 } } } }
                ];
            }
        }

        const [customers, count] = await Promise.all([
            prisma.customer.findMany({
                where, skip, take: Number(limit),
                include: {
                    assignedUser: { select: { id: true, fullName: true } },
                    debtPeriods: { where: { periodName: targetYearStr }, take: 1 } 
                },
                orderBy: { createdBy: 'desc' }
            }),
            prisma.customer.count({ where })
        ]);

        data = customers.map(c => {
            const debt = c.debtPeriods[0];
            return this._mapToDebtItem(c, debt, 'customer', targetYearStr);
        });
        total = count;
    }

    // --- 2. LỌC THEO NCC (Query bảng Supplier) ---
    else if (type === 'supplier') {
        const where: any = { status: 'active' };

        if (search) {
            where.OR = [
                { supplierName: { contains: search } },
                { supplierCode: { contains: search } },
                { phone: { contains: search } }
            ];
        }
        
        // ✅ NCC: Lọc theo cột address (Vì NCC không có cột province riêng)
        if (province) where.address = { contains: province };

        if (assignedUserId) where.assignedUserId = Number(assignedUserId);

        if (status) {
            const debtCondition = { periodName: targetYearStr };
            if (status === 'unpaid') {
                where.debtPeriods = { some: { ...debtCondition, closingBalance: { gt: 1000 } } };
            } else {
                where.OR = [
                    { debtPeriods: { none: { periodName: targetYearStr } } },
                    { debtPeriods: { some: { ...debtCondition, closingBalance: { lte: 1000 } } } }
                ];
            }
        }

        const [suppliers, count] = await Promise.all([
            prisma.supplier.findMany({
                where, skip, take: Number(limit),
                include: {
                    assignedUser: { select: { id: true, fullName: true } },
                    debtPeriods: { where: { periodName: targetYearStr }, take: 1 }
                }
            }),
            prisma.supplier.count({ where })
        ]);

        data = suppliers.map(s => {
            const debt = s.debtPeriods[0];
            return this._mapToDebtItem(s, debt, 'supplier', targetYearStr);
        });
        total = count;
    }

    // --- 3. TẤT CẢ (Query bảng DebtPeriod) ---
    else {
        const where: any = { periodName: targetYearStr };
        
        // Mảng điều kiện AND để kết hợp Search + Province + User
        const andConditions: any[] = [];

        // a. Search Text
        if (search) {
            andConditions.push({
                OR: [
                    { customer: { customerName: { contains: search } } },
                    { customer: { customerCode: { contains: search } } },
                    { supplier: { supplierName: { contains: search } } },
                    { supplier: { supplierCode: { contains: search } } }
                ]
            });
        }

        // b. Filter Tỉnh/Thành (QUAN TRỌNG: Lọc cả 2 bảng)
        if (province) {
            andConditions.push({
                OR: [
                    // Tìm trong Khách (cột province)
                    { customer: { province: { contains: province } } },
                    // Tìm trong NCC (cột address)
                    { supplier: { address: { contains: province } } }
                ]
            });
        }

        // c. Filter User phụ trách
        if (assignedUserId) {
            andConditions.push({
                OR: [
                    { customer: { assignedUserId: Number(assignedUserId) } },
                    { supplier: { assignedUserId: Number(assignedUserId) } }
                ]
            });
        }

        // Gán vào where chính
        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        if (status === 'paid') where.closingBalance = { lte: 1000 };
        else if (status === 'unpaid') where.closingBalance = { gt: 1000 };

        const [periods, count] = await Promise.all([
            prisma.debtPeriod.findMany({
                where, skip, take: Number(limit),
                orderBy: { closingBalance: 'desc' },
                include: {
                    customer: { include: { assignedUser: true } },
                    supplier: { include: { assignedUser: true } }
                }
            }),
            prisma.debtPeriod.count({ where })
        ]);

        data = periods.map(p => {
            const isCustomer = !!p.customerId;
            const obj = isCustomer ? p.customer : p.supplier;
            return this._mapToDebtItem(obj, p, isCustomer ? 'customer' : 'supplier', targetYearStr);
        });
        total = count;
    }

    const globalSummary = await this.getGlobalSummary(targetYearStr, type, assignedUserId);

    const result = {
        data, // Biến data lấy từ logic query List (bước trước)
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
            summary: globalSummary // ✅ Số liệu này luôn đúng và cố định
        }
    };

    await this.cache.setDebtList(queryHash, result);
    return result;
  }

  // =========================================================================
  // 🛠️ HELPER: TÍNH TỔNG TOÀN CỤC (CỐ ĐỊNH THEO NĂM & LOẠI)
  // =========================================================================
  async getGlobalSummary(year: string, type?: string, assignedUserId?: number) {
    // Điều kiện lọc CỐ ĐỊNH: Chỉ theo Năm và Loại (Khách/NCC)
    // ⚠️ TUYỆT ĐỐI KHÔNG đưa Search Text hay Tỉnh Thành vào đây
    const where: any = { periodName: year };

    if (type === 'customer') {
        where.customerId = { not: null };
    } else if (type === 'supplier') {
        where.supplierId = { not: null };
    }

    // Nếu lọc theo User phụ trách thì Summary cũng nên theo User đó (Logic Dashboard cá nhân)
    if (assignedUserId) {
        where.OR = [
            { customer: { assignedUserId: Number(assignedUserId) } },
            { supplier: { assignedUserId: Number(assignedUserId) } }
        ];
    }

    // Thực hiện tính toán
    const agg = await prisma.debtPeriod.aggregate({
        _sum: { 
            openingBalance: true, 
            increasingAmount: true, 
            decreasingAmount: true, 
            returnAmount: true,      // Tổng trả hàng
            adjustmentAmount: true,  // Tổng điều chỉnh
            closingBalance: true 
        },
        where
    });

    return {
        opening: Number(agg._sum.openingBalance || 0),
        increase: Number(agg._sum.increasingAmount || 0),
        payment: Number(agg._sum.decreasingAmount || 0),
        returnAmount: Number(agg._sum.returnAmount || 0),
        adjustmentAmount: Number(agg._sum.adjustmentAmount || 0),
        closing: Number(agg._sum.closingBalance || 0),
    };
  }

  // ---------------------------------------------------------------------------
  // HELPER: Map Data thống nhất
  // ---------------------------------------------------------------------------
  private _mapToDebtItem(obj: any, debt: any, type: 'customer' | 'supplier', year: string) {
    if (!obj) return null;
    return {
        id: debt?.id || 0, // Nếu chưa có DebtPeriod, ID = 0
        type,
        objId: obj.id,
        code: type === 'customer' ? obj.customerCode : obj.supplierCode,
        name: type === 'customer' ? obj.customerName : obj.supplierName,
        phone: obj.phone,
        location: type === 'customer' 
            ? [obj.district, obj.province].filter(Boolean).join(', ') 
            : obj.address, // NCC dùng address
        avatar: type === 'customer' ? obj.avatarUrl : null,
        assignedUser: obj.assignedUser,
        
        periodName: year,
        // Nếu không có debt record -> Tất cả bằng 0
        openingBalance: Number(debt?.openingBalance || 0),
        increasingAmount: Number(debt?.increasingAmount || 0),
        decreasingAmount: Number(debt?.decreasingAmount || 0),
        returnAmount: Number(debt?.returnAmount || 0),
        adjustmentAmount: Number(debt?.adjustmentAmount || 0),
        closingBalance: Number(debt?.closingBalance || 0),
        
        status: Number(debt?.closingBalance || 0) > 1000 ? 'unpaid' : 'paid',
        updatedAt: debt?.updatedAt || new Date().toISOString(),
        notes: debt?.notes || ''
    };
  }

// =========================================================================
  // 2. GET DETAIL (CÓ REDIS CACHE + CÁC TRƯỜNG MỚI TỪ DB THẬT)
  // =========================================================================
  async getDetail(id: number, type: 'customer' | 'supplier', year?: number) {
    const targetYear = year || new Date().getFullYear();
    const periodName = String(targetYear);

    // 🟢 BƯỚC 1: KIỂM TRA CACHE
    const cachedData = await this.cache.getDebtDetail(id, type, targetYear);
    if (cachedData) {
        console.log(`🚀 Cache Hit: Smart Debt Detail [${type}:${id}:${targetYear}]`);
        return cachedData;
    }

    // 🟢 BƯỚC 2: LOGIC QUERY DB
    console.log(`🐢 Cache Miss: Querying DB for Detail...`);

    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    let entityInfo: any = null;
    let debtPeriod: any = null;
    let orders: any[] = [];
    let payments: any[] = [];
    
    // Biến cho các nghiệp vụ mới (Trả hàng, Điều chỉnh)
    let returns: any[] = []; 
    let adjustments: any[] = []; // Hiện tại chưa có bảng adjustment, để trống

    if (type === 'customer') {
      const customer = await prisma.customer.findUnique({
        where: { id: Number(id) },
        include: { assignedUser: true }
      });
      if (!customer) throw new NotFoundError('Không tìm thấy khách hàng này.');
      
      entityInfo = {
        id: customer.id,
        code: customer.customerCode,
        name: customer.customerName,
        phone: customer.phone,
        address: customer.address,
        email: customer.email,
        avatar: customer.avatarUrl,
        type: 'customer',
        assignedUser: customer.assignedUser,
        province: customer.province,
        district: customer.district
      };

      debtPeriod = await prisma.debtPeriod.findUnique({
        where: { customerId_periodName: { customerId: Number(id), periodName } }
      });

      orders = await prisma.salesOrder.findMany({
        where: { 
            customerId: Number(id), 
            orderDate: { gte: startOfYear, lte: endOfYear },
            orderStatus: { not: 'cancelled' } 
        },
        orderBy: { orderDate: 'desc' },
        select: {
            id: true, orderCode: true, totalAmount: true, orderDate: true, orderStatus: true,
            notes: true,
            details: {
                select: {
                    quantity: true, unitPrice: true,
                    product: { select: { id: true, productName: true, sku: true } }
                }
            }
        }
      });

      payments = await prisma.paymentReceipt.findMany({
        where: { 
            customerId: Number(id), 
            receiptDate: { gte: startOfYear, lte: endOfYear } 
        },
        orderBy: { receiptDate: 'desc' },
        select: { id: true, receiptCode: true, amount: true, receiptDate: true, notes: true }
      });

      // ✅ LẤY DỮ LIỆU TRẢ HÀNG TỪ KHO (Sale Refunds)
      const orderIds = orders.map(o => o.id);
      if (orderIds.length > 0) {
          const stockReturns = await prisma.stockTransaction.findMany({
              where: {
                  transactionType: 'import',      // Nhập kho lại
                  referenceType: 'sale_refunds',  // Khách trả hàng
                  referenceId: { in: orderIds },  // Thuộc các đơn hàng của khách này
                  // created_at: { gte: startOfYear, lte: endOfYear } // (Optional: lọc theo ngày phiếu)
              },
              orderBy: { createdAt: 'desc' },
              include: {
                  details: {
                      include: { product: { select: { productName: true, sku: true } } }
                  }
              }
          });

          // Map về cấu trúc hiển thị
          returns = stockReturns.map(r => ({
              id: r.id,
              code: r.transactionCode,
              date: r.createdAt,
              amount: Number(r.totalValue),
              note: r.reason || r.notes || 'Khách trả hàng',
              details: r.details
          }));
      }

    } else {
      const supplier = await prisma.supplier.findUnique({
        where: { id: Number(id) },
        include: { assignedUser: true }
      });
      if (!supplier) throw new NotFoundError('Không tìm thấy nhà cung cấp này.');
      
      entityInfo = {
        id: supplier.id,
        code: supplier.supplierCode,
        name: supplier.supplierName,
        phone: supplier.phone,
        address: supplier.address,
        email: supplier.email,
        type: 'supplier',
        assignedUser: supplier.assignedUser,
        // Nhà cung cấp thường ít dùng tỉnh/huyện hơn, nhưng nếu model có thì thêm vào
      };

      debtPeriod = await prisma.debtPeriod.findUnique({
        where: { supplierId_periodName: { supplierId: Number(id), periodName } }
      });

      orders = await prisma.purchaseOrder.findMany({
        where: { 
            supplierId: Number(id), 
            orderDate: { gte: startOfYear, lte: endOfYear },
            status: { not: 'cancelled' } 
        },
        orderBy: { orderDate: 'desc' },
        select: {
            id: true, poCode: true, totalAmount: true, orderDate: true, status: true,
            notes: true,
            details: {
                include: { product: { select: { id: true, productName: true, sku: true } } }
            }
        }
      });

      payments = await prisma.paymentVoucher.findMany({
        where: { 
            supplierId: Number(id), 
            paymentDate: { gte: startOfYear, lte: endOfYear } 
        },
        orderBy: { paymentDate: 'desc' },
        select: { id: true, voucherCode: true, amount: true, paymentDate: true, notes: true }
      });
      
      // ✅ LẤY DỮ LIỆU TRẢ HÀNG NCC TỪ KHO (Purchase Refunds)
      const poIds = orders.map(p => p.id);
      if (poIds.length > 0) {
          const stockReturns = await prisma.stockTransaction.findMany({
              where: {
                  transactionType: 'export',          // Xuất trả NCC
                  referenceType: 'purchase_refunds',  // Trả hàng mua
                  referenceId: { in: poIds },
              },
              orderBy: { createdAt: 'desc' },
              include: {
                  details: {
                      include: { product: { select: { productName: true, sku: true } } }
                  }
              }
          });

          returns = stockReturns.map(r => ({
              id: r.id,
              code: r.transactionCode,
              date: r.createdAt,
              amount: Number(r.totalValue),
              note: r.reason || r.notes || 'Trả hàng NCC',
              details: r.details
          }));
      }
    }

    // Flatten Product History
    let productHistory: any[] = [];
    orders.forEach((order: any) => {
        if (order.details) {
            order.details.forEach((item: any) => {
                productHistory.push({
                    orderId: order.id,
                    orderCode: order.orderCode || order.poCode,
                    date: order.orderDate,
                    productId: item.productId, 
                    productName: item.product?.productName || "Sản phẩm đã xóa",
                    sku: item.product?.sku,
                    quantity: Number(item.quantity),
                    price: Number(item.unitPrice || item.price || 0),
                });
            });
        }
    });

    // Tính tổng tiền trả hàng thực tế từ DB
    const totalReturnReal = returns.reduce((sum, item) => sum + item.amount, 0);
    const totalAdjustReal = 0; // Chưa có logic adjustment

    // Logic tính Closing Balance:
    // Closing = Opening + Increase - (Payment + Return + Adjust)
    // Lưu ý: Cột decreasingAmount trong DB thường lưu tổng giảm (Payment + Return) nếu hàm Sync đã gộp.
    // Nếu hàm Sync chưa gộp return vào decreasingAmount, thì ta trừ thủ công ở đây.
    // Giả sử hàm SyncSnap đã gộp return vào decreasingAmount, thì closingBalance trong DB là đúng.
    // Nhưng để hiển thị tách bạch trên UI, ta cần:
    // - Payment (Thanh toán thuần) = decreasingAmount (DB) - Return (DB)
    // - Return = Return (DB)
    
    // Tuy nhiên, vì bảng DebtPeriod hiện tại CHƯA có cột returnAmount riêng,
    // và decreasingAmount đang chứa cả hai (hoặc chỉ payment tùy logic sync cũ).
    // An toàn nhất là tính toán lại closing để hiển thị realtime:
    
    const opening = Number(debtPeriod?.openingBalance || 0);
    const increase = Number(debtPeriod?.increasingAmount || 0);
    // Giả sử decreasingAmount trong DB chỉ là tiền thanh toán (từ PaymentReceipt/Voucher)
    // Nếu syncSnap logic cũ chỉ cộng PaymentReceipt vào decreasingAmount, thì Return chưa được trừ.
    const payment = Number(debtPeriod?.decreasingAmount || 0); 
    
    // Vậy Closing hiển thị sẽ là:
    const closingCalculated = opening + increase - payment - totalReturnReal;

    const financials = debtPeriod ? {
        opening,
        increase,
        payment, // Đây là tiền thanh toán
        
        returnAmount: totalReturnReal, 
        adjustmentAmount: totalAdjustReal,

        closing: closingCalculated, // Số dư cuối kỳ chính xác
        status: closingCalculated > 1000 ? 'unpaid' : 'paid'
    } : {
        opening: 0, increase: 0, payment: 0, 
        returnAmount: totalReturnReal, 
        adjustmentAmount: 0, 
        closing: 0 - totalReturnReal, // Khách trả hàng khi chưa mua gì -> Âm nợ (Có tiền dư)
        status: 'paid'
    };

    const response = {
        info: entityInfo,
        periodName,
        hasData: !!debtPeriod || orders.length > 0,
        financials,
        history: {
            orders,
            payments,
            products: productHistory,
            returns: returns,       // Danh sách trả hàng
            adjustments: adjustments // Danh sách điều chỉnh
        }
    };

    // 🟢 BƯỚC 3: LƯU VÀO CACHE
    await this.cache.setDebtDetail(id, type, targetYear, response);

    return response;
  }

// =================================================================
  // 1. SYNC FULL (Đồng bộ toàn bộ lịch sử & Xóa Cache)
  // =================================================================
  async syncFull(data: SyncDebtParams) {
    const { customerId, supplierId, notes, assignedUserId } = data;

    // Validate input
    if ((!customerId && !supplierId) || (customerId && supplierId)) {
      throw new ValidationError('Phải chọn một Khách hàng hoặc một Nhà cung cấp');
    }

    const targetYear = data.year || new Date().getFullYear();

    // 🟢 BƯỚC 1: GÁN TRANSACTION VÀO BIẾN 'RESULT'
    const result = await prisma.$transaction(async (tx) => {
      
      // 1.1. KIỂM TRA SỰ TỒN TẠI & CẬP NHẬT NGƯỜI QUẢN LÝ
      if (customerId) {
        const customer = await tx.customer.findUnique({ where: { id: Number(customerId) } });
        if (!customer) throw new NotFoundError(`Khách hàng ID ${customerId} không tồn tại`);
        
        if (assignedUserId) {
            await tx.customer.update({
                where: { id: Number(customerId) },
                data: { assignedUserId: Number(assignedUserId) }
            });
        }

      } else if (supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: Number(supplierId) } });
        if (!supplier) throw new NotFoundError(`Nhà cung cấp ID ${supplierId} không tồn tại`);

        if (assignedUserId) {
            await tx.supplier.update({
                where: { id: Number(supplierId) },
                data: { assignedUserId: Number(assignedUserId) }
            });
        }
      }

      // 1.2. TÌM NĂM BẮT ĐẦU (Quét lịch sử)
      let startYear = targetYear; 

      if (customerId) {
        const firstOrder = await tx.salesOrder.findFirst({
          where: { customerId: Number(customerId) },
          orderBy: { orderDate: 'asc' }, select: { orderDate: true }
        });
        const firstReceipt = await tx.paymentReceipt.findFirst({
            where: { customerId: Number(customerId) },
            orderBy: { receiptDate: 'asc' }, select: { receiptDate: true }
        });
        const orderYear = firstOrder ? firstOrder.orderDate.getFullYear() : targetYear;
        const receiptYear = firstReceipt ? firstReceipt.receiptDate.getFullYear() : targetYear;
        startYear = Math.min(orderYear, receiptYear);

      } else if (supplierId) {
        const firstPO = await tx.purchaseOrder.findFirst({
          where: { supplierId: Number(supplierId) },
          orderBy: { orderDate: 'asc' }, select: { orderDate: true }
        });
        const firstVoucher = await tx.paymentVoucher.findFirst({
            where: { supplierId: Number(supplierId) },
            orderBy: { paymentDate: 'asc' }, select: { paymentDate: true }
        });
        const poYear = firstPO ? firstPO.orderDate.getFullYear() : targetYear;
        const voucherYear = firstVoucher ? firstVoucher.paymentDate.getFullYear() : targetYear;
        startYear = Math.min(poYear, voucherYear);
      }

      // Fallback nếu dữ liệu tương lai
      if (startYear > targetYear) startYear = targetYear;

      console.log(`🔄 [SyncFull] Đang đồng bộ từ năm ${startYear} đến ${targetYear}...`);

      // 1.3. TÍNH SỐ DƯ ĐẦU KỲ CỦA "NĂM KHỞI THỦY"
      // (Công thức: Đầu kỳ = Tổng Mua Quá Khứ - Tổng Trả Tiền Quá Khứ - Tổng Trả Hàng Quá Khứ)
      let currentOpeningBalance = 0;
      const startOfStartYear = new Date(startYear, 0, 1);

      if (customerId) {
         // A. Tăng (Mua hàng quá khứ)
         const prevOrders = await tx.salesOrder.aggregate({
           where: { customerId: Number(customerId), orderDate: { lt: startOfStartYear }, orderStatus: { not: 'cancelled' } },
           _sum: { totalAmount: true }
         });
         
         // B. Giảm (Trả tiền quá khứ)
         const prevReceipts = await tx.paymentReceipt.aggregate({
           where: { customerId: Number(customerId), receiptDate: { lt: startOfStartYear } },
           _sum: { amount: true }
         });

         // C. Giảm (Trả hàng quá khứ) - ✅ LOGIC MỚI
         let prevReturnAmount = 0;
         // B1: Lấy danh sách đơn hàng cũ
         const pastOrders = await tx.salesOrder.findMany({
             where: { customerId: Number(customerId), orderDate: { lt: startOfStartYear } },
             select: { id: true }
         });
         // B2: Tính tổng trả hàng từ kho
         if (pastOrders.length > 0) {
             const pastOrderIds = pastOrders.map((o: any) => o.id);
             const stockReturns = await tx.stockTransaction.aggregate({
                 where: {
                     transactionType: 'import',
                     referenceType: 'sale_refunds',
                     referenceId: { in: pastOrderIds },
                     createdAt: { lt: startOfStartYear }
                 },
                 _sum: { totalValue: true }
             });
             prevReturnAmount = Number(stockReturns._sum.totalValue || 0);
         }

         currentOpeningBalance = Number(prevOrders._sum.totalAmount || 0) 
                               - Number(prevReceipts._sum.amount || 0)
                               - prevReturnAmount;

      } else if (supplierId) {
         // A. Tăng (Mua hàng quá khứ)
         const prevPO = await tx.purchaseOrder.aggregate({
           where: { supplierId: Number(supplierId), orderDate: { lt: startOfStartYear }, status: { not: 'cancelled' } },
           _sum: { totalAmount: true }
         });
         // B. Giảm (Trả tiền quá khứ)
         const prevVouchers = await tx.paymentVoucher.aggregate({
           where: { supplierId: Number(supplierId), paymentDate: { lt: startOfStartYear } },
           _sum: { amount: true }
         });
         // C. Giảm (Trả hàng quá khứ) - ✅ LOGIC MỚI
         let prevReturnAmount = 0;
         const pastPOs = await tx.purchaseOrder.findMany({
             where: { supplierId: Number(supplierId), orderDate: { lt: startOfStartYear } },
             select: { id: true }
         });
         if (pastPOs.length > 0) {
             const pastPOIds = pastPOs.map((p: any) => p.id);
             const stockReturns = await tx.stockTransaction.aggregate({
                 where: {
                     transactionType: 'export',
                     referenceType: 'purchase_refunds',
                     referenceId: { in: pastPOIds },
                     createdAt: { lt: startOfStartYear }
                 },
                 _sum: { totalValue: true }
             });
             prevReturnAmount = Number(stockReturns._sum.totalValue || 0);
         }

         currentOpeningBalance = Number(prevPO._sum.totalAmount || 0) 
                               - Number(prevVouchers._sum.amount || 0)
                               - prevReturnAmount;
      }

      // 1.4. VÒNG LẶP THỜI GIAN
      for (let y = startYear; y <= targetYear; y++) {
        const isTargetYear = y === targetYear;
        const currentNotes = isTargetYear ? notes : `Đồng bộ lịch sử tự động năm ${y}`;

        // Gọi hàm xử lý và cập nhật lại currentOpeningBalance cho vòng lặp kế tiếp
        currentOpeningBalance = await this._processSinglePeriod(
            tx, 
            y, 
            currentOpeningBalance, 
            customerId ? Number(customerId) : undefined, 
            supplierId ? Number(supplierId) : undefined, 
            currentNotes
        );
      }

      // 1.5. TRẢ KẾT QUẢ TRANSACTION
      return { 
        message: "Đồng bộ hoàn tất", 
        year: targetYear,
        finalDebt: currentOpeningBalance 
      };

    }, {
      maxWait: 10000, 
      timeout: 120000 
    });

    // 🟢 BƯỚC 2: XÓA CACHE (SAU KHI TRANSACTION THÀNH CÔNG)
    await this.cache.invalidateSmartDebt();
    console.log(`🧹 Cache cleared after Sync Full for ${customerId ? 'Customer' : 'Supplier'}`);

    // 🟢 BƯỚC 3: RETURN FINAL RESULT
    return result;
  }



// =================================================================
  // 2. SYNC SNAP (CẬP NHẬT: GHI VÀO CỘT RIÊNG & TÍNH TRẢ HÀNG)
  // =================================================================
  async syncSnap(data: SyncDebtParams) {
    const { customerId, supplierId, notes, assignedUserId } = data;

    if ((!customerId && !supplierId) || (customerId && supplierId)) {
      throw new ValidationError('Phải chọn một Khách hàng hoặc một Nhà cung cấp');
    }

    const year = data.year || new Date().getFullYear();
    const periodName = `${year}`;
    const prevPeriodName = `${year - 1}`;
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // 🟢 BƯỚC 1: GÁN TRANSACTION VÀO BIẾN 'RESULT'
    const result = await prisma.$transaction(async (tx) => {
      
      // 2.1. KIỂM TRA SỰ TỒN TẠI
      if (customerId) {
        const customer = await tx.customer.findUnique({ where: { id: Number(customerId) } });
        if (!customer) throw new NotFoundError(`Khách hàng ID ${customerId} không tồn tại`);
        if (assignedUserId) {
             await tx.customer.update({ where: { id: Number(customerId) }, data: { assignedUserId: Number(assignedUserId) } });
        }
      } else if (supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: Number(supplierId) } });
        if (!supplier) throw new NotFoundError(`Nhà cung cấp ID ${supplierId} không tồn tại`);
        if (assignedUserId) {
             await tx.supplier.update({ where: { id: Number(supplierId) }, data: { assignedUserId: Number(assignedUserId) } });
        }
      }

      // 2.2. TÍNH NỢ ĐẦU KỲ
      let openingBalance = 0;
      let calculationMethod = 'SNAPSHOT';

      const wherePrevPeriod = customerId 
        ? { customerId_periodName: { customerId: Number(customerId), periodName: prevPeriodName } }
        : { supplierId_periodName: { supplierId: Number(supplierId), periodName: prevPeriodName } };

      const prevPeriod = await tx.debtPeriod.findUnique({ where: wherePrevPeriod });

      if (prevPeriod) {
        openingBalance = Number(prevPeriod.closingBalance);
      } else {
        calculationMethod = 'AGGREGATE_FALLBACK';
        // Logic tính fallback nếu chưa có kỳ trước (Tính tổng lịch sử)
        const startOfStartYear = startOfYear;
        
        if (customerId) {
          const prevOrders = await tx.salesOrder.aggregate({
            where: { customerId: Number(customerId), orderDate: { lt: startOfStartYear }, orderStatus: { not: 'cancelled' } },
            _sum: { totalAmount: true }
          });
          const prevReceipts = await tx.paymentReceipt.aggregate({
            where: { customerId: Number(customerId), receiptDate: { lt: startOfStartYear } },
            _sum: { amount: true }
          });
          // Lưu ý: Fallback này tạm thời chưa trừ trả hàng quá khứ (để đơn giản), 
          // nếu muốn chính xác tuyệt đối nên chạy SyncFull.
          openingBalance = Number(prevOrders._sum.totalAmount || 0) - Number(prevReceipts._sum.amount || 0);
        } else if (supplierId) {
          const prevPO = await tx.purchaseOrder.aggregate({
            where: { supplierId: Number(supplierId), orderDate: { lt: startOfStartYear }, status: { not: 'cancelled' } },
            _sum: { totalAmount: true }
          });
          const prevVouchers = await tx.paymentVoucher.aggregate({
            where: { supplierId: Number(supplierId), paymentDate: { lt: startOfStartYear } },
            _sum: { amount: true }
          });
          openingBalance = Number(prevPO._sum.totalAmount || 0) - Number(prevVouchers._sum.amount || 0);
        }
      }

      // 2.3. TÍNH PHÁT SINH TRONG KỲ
      let increasingAmount = 0; // Tăng (Mua)
      let paymentAmount = 0;    // Giảm (Tiền) -> Lưu vào decreasingAmount
      let returnAmount = 0;     // Giảm (Hàng) -> Lưu vào returnAmount
      let adjustmentAmount = 0; // Điều chỉnh -> Lưu vào adjustmentAmount

      if (customerId) {
        // A. Tăng: Đơn hàng
        const currOrders = await tx.salesOrder.aggregate({
          where: { customerId: Number(customerId), orderDate: { gte: startOfYear, lte: endOfYear }, orderStatus: { not: 'cancelled' } },
          _sum: { totalAmount: true }
        });
        increasingAmount = Number(currOrders._sum.totalAmount || 0);

        // B. Giảm 1: Thanh toán (Phiếu thu)
        const currReceipts = await tx.paymentReceipt.aggregate({
          where: { customerId: Number(customerId), receiptDate: { gte: startOfYear, lte: endOfYear } },
          _sum: { amount: true }
        });
        paymentAmount = Number(currReceipts._sum.amount || 0);

        // C. Giảm 2: Trả hàng (Stock Import - sale_refunds) - ✅ LOGIC MỚI
        const orderList = await tx.salesOrder.findMany({
            where: { customerId: Number(customerId), orderDate: { gte: startOfYear, lte: endOfYear } },
            select: { id: true }
        });
        if (orderList.length > 0) {
            const ids = orderList.map((o:any) => o.id);
            const stockReturns = await tx.stockTransaction.aggregate({
                where: {
                    transactionType: 'import',
                    referenceType: 'sale_refunds', 
                    referenceId: { in: ids },
                    createdAt: { gte: startOfYear, lte: endOfYear }
                },
                _sum: { totalValue: true }
            });
            returnAmount = Number(stockReturns._sum.totalValue || 0);
        }

      } else if (supplierId) {
        // A. Tăng: PO
        const currPO = await tx.purchaseOrder.aggregate({
          where: { supplierId: Number(supplierId), orderDate: { gte: startOfYear, lte: endOfYear }, status: { not: 'cancelled' } },
          _sum: { totalAmount: true }
        });
        increasingAmount = Number(currPO._sum.totalAmount || 0);

        // B. Giảm 1: Thanh toán (Phiếu chi)
        const currVouchers = await tx.paymentVoucher.aggregate({
          where: { supplierId: Number(supplierId), paymentDate: { gte: startOfYear, lte: endOfYear } },
          _sum: { amount: true }
        });
        paymentAmount = Number(currVouchers._sum.amount || 0);

        // C. Giảm 2: Trả hàng (Stock Export - purchase_refunds) - ✅ LOGIC MỚI
        const poList = await tx.purchaseOrder.findMany({
            where: { supplierId: Number(supplierId), orderDate: { gte: startOfYear, lte: endOfYear } },
            select: { id: true }
        });
        if (poList.length > 0) {
            const ids = poList.map((p:any) => p.id);
            const stockReturns = await tx.stockTransaction.aggregate({
                where: {
                    transactionType: 'export',
                    referenceType: 'purchase_refunds', 
                    referenceId: { in: ids },
                    createdAt: { gte: startOfYear, lte: endOfYear }
                },
                _sum: { totalValue: true }
            });
            returnAmount = Number(stockReturns._sum.totalValue || 0);
        }
      }

      // 2.4. CHỐT SỐ (CÔNG THỨC MỚI)
      const closingBalance = openingBalance + increasingAmount - paymentAmount - returnAmount - adjustmentAmount;

      let finalNote = notes || '';
      if (calculationMethod === 'AGGREGATE_FALLBACK') {
        const autoNote = `(Tự động tính lại đầu kỳ do thiếu dữ liệu năm ${prevPeriodName})`;
        finalNote = finalNote ? `${finalNote} ${autoNote}` : autoNote;
      }

      // 2.5. LƯU DB (Mapping vào đúng cột mới)
      const whereClause = customerId 
        ? { customerId_periodName: { customerId: Number(customerId), periodName } }
        : { supplierId_periodName: { supplierId: Number(supplierId), periodName } };

      const period = await tx.debtPeriod.upsert({
        where: whereClause,
        update: {
          openingBalance,
          increasingAmount,
          decreasingAmount: paymentAmount, // ✅ Chỉ lưu tiền
          returnAmount,                    // ✅ Lưu trả hàng riêng
          adjustmentAmount,                // ✅ Lưu điều chỉnh riêng
          closingBalance,
          updatedAt: new Date(),
          ...(notes ? { notes: finalNote } : {})
        },
        create: {
          customerId: customerId ? Number(customerId) : null,
          supplierId: supplierId ? Number(supplierId) : null,
          periodName,
          startTime: startOfYear,
          endTime: endOfYear,
          openingBalance,
          increasingAmount,
          decreasingAmount: paymentAmount,
          returnAmount,
          adjustmentAmount,
          closingBalance,
          notes: finalNote,
          isLocked: false
        }
      });

      // 2.6. CẬP NHẬT SỐ DƯ BẢNG CHÍNH (Nếu năm hiện tại)
      const currentYear = new Date().getFullYear();
      if (year >= currentYear) {
        if (customerId) {
          await tx.customer.update({
            where: { id: Number(customerId) },
            data: { currentDebt: closingBalance, debtUpdatedAt: new Date() }
          });
        } else if (supplierId) {
          await tx.supplier.update({
            where: { id: Number(supplierId) },
            data: { totalPayable: closingBalance, payableUpdatedAt: new Date() }
          });
        }
      }

      // 2.7. TRẢ KẾT QUẢ TRANSACTION
      const status = closingBalance <= 1000 ? 'paid' : 'unpaid';
      return { 
          ...period, 
          status, 
          method: calculationMethod 
      };
    });

    // 🟢 BƯỚC 2: XÓA CACHE (SAU KHI TRANSACTION THÀNH CÔNG)
    await this.cache.invalidateSmartDebt();
    console.log(`🧹 Cache cleared after Sync Snap for ${customerId ? 'Customer' : 'Supplier'}`);

    // 🟢 BƯỚC 3: RETURN FINAL RESULT
    return result;
  }

// =================================================================
  // 3. SYNC FULL ALL (Chạy batch - Không cần sửa logic chính, chỉ cần helper chuẩn)
  // =================================================================
  async syncFullAll(year: number) {
    const targetYear = year || new Date().getFullYear();
    
    console.log(`🚀 [Batch Full] Bắt đầu đồng bộ toàn bộ dữ liệu lịch sử cho năm ${targetYear}...`);
    const start = Date.now();

    // 1. Lấy danh sách ID cần chạy (Cập nhật helper để lấy cả người trả hàng)
    const activeCustomerIds = await this._getActiveCustomerIds(targetYear);
    const activeSupplierIds = await this._getActiveSupplierIds(targetYear);

    const totalTasks = activeCustomerIds.length + activeSupplierIds.length;
    console.log(`📊 Tìm thấy ${activeCustomerIds.length} Khách hàng và ${activeSupplierIds.length} NCC có hoạt động.`);

    let successCount = 0;
    let failCount = 0;
    const errors: any[] = [];

    // 2. Chạy vòng lặp cho KHÁCH HÀNG
    for (const customerId of activeCustomerIds) {
      try {
        await this.syncFull({
          customerId,
          year: targetYear,
          notes: 'Đồng bộ hệ thống định kỳ (Batch Job)'
        });
        successCount++;
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
          year: targetYear,
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
    console.log(`✅ [Batch Full] Hoàn tất sau ${duration}s. Thành công: ${successCount}/${totalTasks}, Thất bại: ${failCount}`);

    // 🔥 XÓA CACHE TOÀN CỤC LẦN CUỐI
    await this.cache.invalidateSmartDebt();

    return {
      year: targetYear,
      mode: 'FULL_ALL',
      totalChecked: totalTasks,
      success: successCount,
      failed: failCount,
      durationSeconds: duration,
      errors 
    };
  }

  // =================================================================
  // 4. SYNC SNAP ALL (Chạy batch nhanh)
  // =================================================================
  async syncSnapAll(year: number) {
    const targetYear = year || new Date().getFullYear();
    console.log(`⚡ [Batch Snap] Bắt đầu đồng bộ nhanh toàn bộ cho năm ${targetYear}...`);
    
    const start = Date.now();

    const activeCustomerIds = await this._getActiveCustomerIds(targetYear);
    const activeSupplierIds = await this._getActiveSupplierIds(targetYear);

    const totalTasks = activeCustomerIds.length + activeSupplierIds.length;
    console.log(`📊 Tìm thấy ${totalTasks} đối tượng có phát sinh giao dịch trong năm.`);

    let successCount = 0;
    let failCount = 0;
    const errors: any[] = [];

    // 2. Chạy vòng lặp cho KHÁCH HÀNG
    for (const customerId of activeCustomerIds) {
      try {
        await this.syncSnap({
          customerId,
          year: targetYear,
          notes: 'Auto-sync: Cập nhật nhanh cuối ngày'
        });
        successCount++;
      } catch (error: any) {
        failCount++;
        console.error(`❌ Lỗi Snap khách ID ${customerId}:`, error.message);
        errors.push({ type: 'customer', id: customerId, error: error.message });
      }
    }

    // 3. Chạy vòng lặp cho NHÀ CUNG CẤP
    for (const supplierId of activeSupplierIds) {
      try {
        await this.syncSnap({
          supplierId,
          year: targetYear,
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

    await this.cache.invalidateSmartDebt();

    return {
      year: targetYear,
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
   * HÀM KIỂM TRA SAI SÓT (AUDIT TOOL)
   * - Check 1: Logic toán học nội bộ (Internal Math)
   * - Check 2: Tính nhất quán giữa các năm (Cross-Period Consistency)
   * - Check 3: Phát hiện kỳ bị thiếu (Missing Periods)
   */
  async checkDataIntegrity(year: number) {
    const targetYear = year || new Date().getFullYear();
    console.log(`🕵️‍♀️ [Check] Bắt đầu kiểm tra dữ liệu năm ${targetYear}...`);

    const discrepancies: any[] = [];
    
    // =========================================================================
    // 1. LẤY DỮ LIỆU ĐỂ SO SÁNH (Năm hiện tại & Năm trước)
    // =========================================================================
    const [currentPeriods, prevPeriods] = await Promise.all([
      prisma.debtPeriod.findMany({
        where: { periodName: String(targetYear) },
        include: { customer: true, supplier: true }
      }),
      prisma.debtPeriod.findMany({
        where: { periodName: String(targetYear - 1) },
        select: { customerId: true, supplierId: true, closingBalance: true }
      })
    ]);

    // Tạo Map tra cứu năm ngoái cho nhanh (O(1))
    // Key: "C-123" (Customer 123) hoặc "S-456" (Supplier 456)
    const prevPeriodMap = new Map<string, number>();
    prevPeriods.forEach(p => {
        const key = p.customerId ? `C-${p.customerId}` : `S-${p.supplierId}`;
        prevPeriodMap.set(key, Number(p.closingBalance));
    });

    const checkedEntityKeys = new Set<string>(); // Để kiểm tra Check 3

    // =========================================================================
    // 2. VÒNG LẶP KIỂM TRA CHÍNH (Internal & Cross-Period)
    // =========================================================================
    for (const curr of currentPeriods) {
      const isCustomer = !!curr.customerId;
      const entityId = isCustomer ? curr.customerId : curr.supplierId;
      const entityKey = isCustomer ? `C-${entityId}` : `S-${entityId}`;
      const entityName = isCustomer ? curr.customer?.customerName : curr.supplier?.supplierName;
      
      checkedEntityKeys.add(entityKey);

      // ---------------------------------------------------------
      // CHECK 1: LOGIC NỘI BỘ (Internal Math)
      // Công thức: Cuối = Đầu + Tăng - Giảm
      // ---------------------------------------------------------
      const calcClosing = Number(curr.openingBalance) + Number(curr.increasingAmount) - Number(curr.decreasingAmount);
      
      // Sai số cho phép (do làm tròn số thực) là 10 đồng
      if (Math.abs(calcClosing - Number(curr.closingBalance)) > 10) {
        discrepancies.push({
          type: 'INTERNAL_MATH_ERROR',
          id: entityId,
          typeObj: isCustomer ? 'customer' : 'supplier',
          name: entityName,
          reason: `Sai lệch công thức nội bộ năm ${targetYear}`,
          details: `Tính toán (${calcClosing}) != Lưu trữ (${curr.closingBalance})`,
          severity: 'CRITICAL' 
        });
      }

      // ---------------------------------------------------------
      // CHECK 2: LIÊN KẾT KỲ TRƯỚC (Cross-Period Check)
      // Công thức: Đầu năm nay == Cuối năm ngoái
      // ---------------------------------------------------------
      if (prevPeriodMap.has(entityKey)) {
        const prevClosing = prevPeriodMap.get(entityKey) || 0;
        const currOpening = Number(curr.openingBalance);

        if (Math.abs(prevClosing - currOpening) > 10) {
          discrepancies.push({
            type: 'CROSS_PERIOD_ERROR',
            id: entityId,
            typeObj: isCustomer ? 'customer' : 'supplier',
            name: entityName,
            reason: `Đứt gãy số liệu giữa ${targetYear - 1} và ${targetYear}`,
            details: `Cuối ${targetYear - 1} (${prevClosing}) != Đầu ${targetYear} (${currOpening})`,
            severity: 'HIGH' 
          });
        }
      }
    }

    // =========================================================================
    // 3. CHECK 3: PHÁT HIỆN KỲ BỊ THIẾU (Missing Periods)
    // Khách có giao dịch trong năm nhưng chưa có bản ghi trong DebtPeriod
    // =========================================================================
    const activeCustomerIds = await this._getActiveCustomerIds(targetYear);
    const activeSupplierIds = await this._getActiveSupplierIds(targetYear);

    // Kiểm tra Khách hàng
    for (const id of activeCustomerIds) {
      if (!checkedEntityKeys.has(`C-${id}`)) {
        discrepancies.push({
          type: 'MISSING_DATA',
          id: id,
          typeObj: 'customer',
          name: `Khách hàng ID ${id}`,
          reason: `Có phát sinh giao dịch năm ${targetYear} nhưng chưa có sổ công nợ`,
          details: 'Cần chạy SyncFull hoặc SyncSnap ngay',
          severity: 'MEDIUM'
        });
      }
    }

    // Kiểm tra NCC
    for (const id of activeSupplierIds) {
      if (!checkedEntityKeys.has(`S-${id}`)) {
        discrepancies.push({
          type: 'MISSING_DATA',
          id: id,
          typeObj: 'supplier',
          name: `Nhà cung cấp ID ${id}`,
          reason: `Có phát sinh giao dịch năm ${targetYear} nhưng chưa có sổ công nợ`,
          details: 'Cần chạy SyncFull hoặc SyncSnap ngay',
          severity: 'MEDIUM'
        });
      }
    }

    return {
      year: targetYear,
      totalChecked: currentPeriods.length,
      discrepanciesCount: discrepancies.length,
      discrepancies
    };
  }

// =========================================================================
  // 5. SEND DEBT NOTICE (CẬP NHẬT: Gửi chi tiết gồm Trả hàng & Điều chỉnh)
  // =========================================================================
  // async sendDebtNotice(
  //   params: {
  //       id: number;                 // ID của Khách hàng hoặc NCC
  //       type: 'customer' | 'supplier';
  //       year?: number;              // Có năm -> Gửi biên bản đối chiếu
  //       customEmail?: string;       // Email nhận (nếu muốn gửi đè)
  //       message?: string;           // Lời nhắn thêm
  //       cc?: string[];
  //   },
  //   userId: number
  // ) {
  //   const { id, type, year, customEmail, message } = params;

  //   // 1. Lấy thông tin Đối tượng & Validate Email
  //   let recipient: any = null;
  //   let currentDebt = 0;

  //   if (type === 'customer') {
  //       const customer = await prisma.customer.findUnique({ where: { id: Number(id) } });
  //       if (!customer) throw new NotFoundError('Khách hàng không tồn tại');
  //       recipient = { name: customer.customerName, email: customer.email, code: customer.customerCode };
  //       currentDebt = Number(customer.currentDebt);
  //   } else {
  //       const supplier = await prisma.supplier.findUnique({ where: { id: Number(id) } });
  //       if (!supplier) throw new NotFoundError('Nhà cung cấp không tồn tại');
  //       recipient = { name: supplier.supplierName, email: supplier.email, code: supplier.supplierCode };
  //       currentDebt = Number(supplier.totalPayable);
  //   }

  //   const toEmail = customEmail || recipient.email;
  //   if (!toEmail) {
  //       throw new ValidationError(`Đối tượng ${recipient.name} chưa có email.`);
  //   }

  //   // 2. Chuẩn bị Dữ liệu & Nội dung Email
  //   let subject = '';
  //   let htmlContent = '';
  //   const fmt = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

  //   if (year) {
  //       // === TRƯỜNG HỢP A: Gửi Biên bản đối chiếu (Report) ===
  //       subject = `[NAM VIỆT] Biên bản đối chiếu công nợ năm ${year} - ${recipient.code}`;
        
  //       // 🔥 GỌI LẠI getDetail ĐỂ LẤY SỐ LIỆU ĐẦY ĐỦ (Bao gồm Return/Adjustment)
  //       const detailData = await this.getDetail(id, type, year);
  //       const fin = detailData.financials;

  //       htmlContent = `
  //           <h3>Kính gửi: ${recipient.name} (${recipient.code})</h3>
  //           <p>Chúng tôi xin gửi thông báo đối chiếu công nợ năm <strong>${year}</strong> như sau:</p>
            
  //           <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px;">
  //               <tr style="background-color: #f3f4f6;">
  //                   <th>Khoản mục</th>
  //                   <th style="text-align: right;">Số tiền</th>
  //               </tr>
  //               <tr>
  //                   <td>Dư nợ đầu kỳ</td>
  //                   <td style="text-align: right;"><b>${fmt.format(fin.opening)}</b></td>
  //               </tr>
  //               <tr>
  //                   <td>Phát sinh tăng (Mua hàng)</td>
  //                   <td style="text-align: right; color: #2563eb;">+${fmt.format(fin.increase)}</td>
  //               </tr>
  //               <tr>
  //                   <td>Đã thanh toán (Tiền)</td>
  //                   <td style="text-align: right; color: #16a34a;">-${fmt.format(fin.payment)}</td>
  //               </tr>
  //               <tr>
  //                   <td>Hàng trả lại</td>
  //                   <td style="text-align: right; color: #4f46e5;">-${fmt.format(fin.returnAmount || 0)}</td>
  //               </tr>
  //               <tr>
  //                   <td>Điều chỉnh khác</td>
  //                   <td style="text-align: right; color: #9333ea;">${(fin.adjustmentAmount || 0) < 0 ? '' : '+'}${fmt.format(fin.adjustmentAmount || 0)}</td>
  //               </tr>
  //               <tr style="background-color: #fff1f2;">
  //                   <td><strong>DƯ NỢ CUỐI KỲ</strong></td>
  //                   <td style="text-align: right; color: #dc2626;"><strong>${fmt.format(fin.closing)}</strong></td>
  //               </tr>
  //           </table>

  //           <p><em>${message || ''}</em></p>
  //           <p>Vui lòng phản hồi lại email này nếu có sai sót.</p>
  //           <hr/>
  //           <p>Trân trọng,<br/>Phòng Kế Toán Nam Việt</p>
  //       `;

  //   } else {
  //       // === TRƯỜNG HỢP B: Gửi Nhắc nợ hiện tại (Reminder) ===
  //       subject = `[NAM VIỆT] Thông báo công nợ hiện tại - ${recipient.code}`;
  //       htmlContent = `
  //           <h3>Kính gửi: ${recipient.name}</h3>
  //           <p>Tính đến thời điểm hiện tại, tổng dư nợ của quý khách là:</p>
  //           <h2 style="color: #dc2626;">${fmt.format(currentDebt)}</h2>
  //           <p><em>${message || 'Vui lòng thanh toán sớm để đảm bảo tiến độ giao hàng.'}</em></p>
  //           <hr/>
  //           <p>Trân trọng,<br/>Phòng Kế Toán Nam Việt</p>
  //       `;
  //   }

  //   // 3. Gửi Email (Giả lập hoặc gọi Service thật)
  //   // await mailService.send({ to: toEmail, subject, html: htmlContent, cc: params.cc });
  //   console.log(`📧 [EMAIL MOCK] To: ${toEmail} | Subject: ${subject}`);
  //   // console.log(htmlContent); // Uncomment để debug HTML

  //   // 4. Ghi Log Hành động
  //   try {
  //       const logAction = year ? `Gửi đối chiếu năm ${year}` : `Gửi nhắc nợ (${fmt.format(currentDebt)})`;
  //       // Hàm logActivity của bạn (giữ nguyên logic cũ)
  //       logActivity(
  //           'EMAIL_DEBT',
  //           userId,
  //           type === 'customer' ? 'Customer' : 'Supplier',
  //           logAction,
  //       ); 
        
  //   } catch (e) {
  //       console.warn("Log activity failed:", e);
  //   }

  //   return {
  //       success: true,
  //       sentTo: toEmail,
  //       type: year ? 'PERIOD_REPORT' : 'CURRENT_REMINDER',
  //       message: `Đã gửi email thành công tới ${toEmail}`
  //   };
  // }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // =================================================================
  // 🛠️ HELPER: XỬ LÝ 1 NĂM (Đã cập nhật logic Trả hàng & Ghi cột riêng)
  // =================================================================
  private async _processSinglePeriod(
      tx: any, 
      year: number, 
      openingBalance: number, 
      customerId?: number, 
      supplierId?: number, 
      notes?: string
  ): Promise<number> {
      
      const periodName = String(year);
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);

      let increasingAmount = 0; // Tăng (Mua)
      let paymentAmount = 0;    // Giảm (Tiền)
      let returnAmount = 0;     // Giảm (Hàng) - ✅ Mới
      let adjustmentAmount = 0; // Điều chỉnh - ✅ Mới (Hiện tại để 0)

      if (customerId) {
          // 1. Tăng: Đơn hàng
          const orders = await tx.salesOrder.aggregate({
              where: { customerId, orderDate: { gte: startOfYear, lte: endOfYear }, orderStatus: { not: 'cancelled' } },
              _sum: { totalAmount: true }
          });
          increasingAmount = Number(orders._sum.totalAmount || 0);

          // 2. Giảm: Thanh toán
          const receipts = await tx.paymentReceipt.aggregate({
              where: { customerId, receiptDate: { gte: startOfYear, lte: endOfYear } },
              _sum: { amount: true }
          });
          paymentAmount = Number(receipts._sum.amount || 0);

          // 3. Giảm: Trả hàng (Sale Refunds) - ✅ Logic Mới
          // B1: Tìm các đơn hàng trong kỳ
          const orderList = await tx.salesOrder.findMany({
              where: { customerId, orderDate: { gte: startOfYear, lte: endOfYear } },
              select: { id: true }
          });
          // B2: Sum total_value từ kho
          if (orderList.length > 0) {
              const ids = orderList.map((o: any) => o.id);
              const stock = await tx.stockTransaction.aggregate({
                  where: {
                      transactionType: 'import',
                      referenceType: 'sale_refunds',
                      referenceId: { in: ids },
                      // Lấy theo ngày nhập kho để ghi nhận đúng thời điểm
                      createdAt: { gte: startOfYear, lte: endOfYear }
                  },
                  _sum: { totalValue: true }
              });
              returnAmount = Number(stock._sum.totalValue || 0);
          }

      } else if (supplierId) {
          // 1. Tăng: PO
          const pos = await tx.purchaseOrder.aggregate({
              where: { supplierId, orderDate: { gte: startOfYear, lte: endOfYear }, status: { not: 'cancelled' } },
              _sum: { totalAmount: true }
          });
          increasingAmount = Number(pos._sum.totalAmount || 0);

          // 2. Giảm: Thanh toán
          const vouchers = await tx.paymentVoucher.aggregate({
              where: { supplierId, paymentDate: { gte: startOfYear, lte: endOfYear } },
              _sum: { amount: true }
          });
          paymentAmount = Number(vouchers._sum.amount || 0);

          // 3. Giảm: Trả hàng (Purchase Refunds) - ✅ Logic Mới
          const poList = await tx.purchaseOrder.findMany({
              where: { supplierId, orderDate: { gte: startOfYear, lte: endOfYear } },
              select: { id: true }
          });
          if (poList.length > 0) {
              const ids = poList.map((p: any) => p.id);
              const stock = await tx.stockTransaction.aggregate({
                  where: {
                      transactionType: 'export',
                      referenceType: 'purchase_refunds',
                      referenceId: { in: ids },
                      createdAt: { gte: startOfYear, lte: endOfYear }
                  },
                  _sum: { totalValue: true }
              });
              returnAmount = Number(stock._sum.totalValue || 0);
          }
      }

      // 4. Tính Chốt sổ (Công thức chuẩn: Đầu + Tăng - TrảTiền - TrảHàng - ĐiềuChỉnh)
      const closingBalance = openingBalance + increasingAmount - paymentAmount - returnAmount - adjustmentAmount;

      // 5. Upsert vào DB (Ghi rõ ràng từng cột)
      const whereClause = customerId 
        ? { customerId_periodName: { customerId, periodName } }
        : { supplierId_periodName: { supplierId, periodName } };

      await tx.debtPeriod.upsert({
          where: whereClause,
          update: {
              openingBalance,
              increasingAmount,
              decreasingAmount: paymentAmount, // ✅ Cột Tiền
              returnAmount,                    // ✅ Cột Hàng
              adjustmentAmount,                // ✅ Cột Điều chỉnh
              closingBalance,
              updatedAt: new Date(),
              ...(notes ? { notes } : {})
          },
          create: {
              customerId: customerId || null,
              supplierId: supplierId || null,
              periodName,
              startTime: startOfYear,
              endTime: endOfYear,
              openingBalance,
              increasingAmount,
              decreasingAmount: paymentAmount,
              returnAmount,
              adjustmentAmount,
              closingBalance,
              notes: notes || '',
              isLocked: false
          }
      });

      // 6. Cập nhật số dư hiện tại vào bảng Master (Customer/Supplier) nếu là năm hiện tại
      if (year === new Date().getFullYear()) {
          if (customerId) {
              await tx.customer.update({ where: { id: customerId }, data: { currentDebt: closingBalance, debtUpdatedAt: new Date() } });
          } else if (supplierId) {
              await tx.supplier.update({ where: { id: supplierId }, data: { totalPayable: closingBalance, payableUpdatedAt: new Date() } });
          }
      }

      // Trả về số dư cuối kỳ để làm đầu kỳ cho vòng lặp năm sau
      return closingBalance; 
  }

  // =================================================================
  // 🛠️ HELPER: LẤY ID KHÁCH HÀNG HOẠT ĐỘNG (CẬP NHẬT MỚI)
  // =================================================================
  private async _getActiveCustomerIds(year: number): Promise<number[]> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // 1. Khách có đơn hàng (Mua)
    const orders = await prisma.salesOrder.findMany({
      where: { orderDate: { gte: startOfYear, lte: endOfYear }, orderStatus: { not: 'cancelled' } },
      select: { customerId: true },
      distinct: ['customerId']
    });

    // 2. Khách có phiếu thu (Trả tiền)
    const receipts = await prisma.paymentReceipt.findMany({
      where: { receiptDate: { gte: startOfYear, lte: endOfYear } },
      select: { customerId: true },
      distinct: ['customerId']
    });

    // 3. Khách có trả hàng (Sale Refunds từ Stock) - ✅ MỚI
    // Vì StockTransaction không có customerId trực tiếp, ta phải đi vòng: Stock -> Order -> Customer
    const stockReturns = await prisma.stockTransaction.findMany({
        where: {
            transactionType: 'import',
            referenceType: 'sale_refunds',
            createdAt: { gte: startOfYear, lte: endOfYear }
        },
        select: { referenceId: true }, // Đây là Order ID
        distinct: ['referenceId']
    });
    
    let returnCustomerIds: number[] = [];
    if (stockReturns.length > 0) {
        const orderIds = stockReturns.map(s => s.referenceId).filter(id => id !== null) as number[];
        if (orderIds.length > 0) {
            const ordersFromReturns = await prisma.salesOrder.findMany({
                where: { id: { in: orderIds } },
                select: { customerId: true },
                distinct: ['customerId']
            });
            returnCustomerIds = ordersFromReturns.map(o => o.customerId);
        }
    }

    // Gộp tất cả và lọc trùng (Set)
    const ids = new Set([
        ...orders.map(o => o.customerId),
        ...receipts.map(r => r.customerId),
        ...returnCustomerIds
    ]);

    return Array.from(ids);
  }

  // =================================================================
  // 🛠️ HELPER: LẤY ID NHÀ CUNG CẤP HOẠT ĐỘNG (CẬP NHẬT MỚI)
  // =================================================================
  private async _getActiveSupplierIds(year: number): Promise<number[]> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // 1. NCC có đơn đặt hàng (Mua)
    const pos = await prisma.purchaseOrder.findMany({
      where: { orderDate: { gte: startOfYear, lte: endOfYear }, status: { not: 'cancelled' } },
      select: { supplierId: true },
      distinct: ['supplierId']
    });

    // 2. NCC có phiếu chi (Trả tiền)
    const vouchers = await prisma.paymentVoucher.findMany({
      where: { paymentDate: { gte: startOfYear, lte: endOfYear } },
      select: { supplierId: true },
      distinct: ['supplierId'] // Lưu ý: voucher có thể null supplierId nếu là chi phí khác
    });
    const voucherSupplierIds = vouchers.filter(v => v.supplierId).map(v => v.supplierId!);

    // 3. NCC có trả hàng (Purchase Refunds từ Stock) - ✅ MỚI
    const stockReturns = await prisma.stockTransaction.findMany({
        where: {
            transactionType: 'export',
            referenceType: 'purchase_refunds',
            createdAt: { gte: startOfYear, lte: endOfYear }
        },
        select: { referenceId: true },
        distinct: ['referenceId']
    });

    let returnSupplierIds: number[] = [];
    if (stockReturns.length > 0) {
        const poIds = stockReturns.map(s => s.referenceId).filter(id => id !== null) as number[];
        if (poIds.length > 0) {
            const posFromReturns = await prisma.purchaseOrder.findMany({
                where: { id: { in: poIds } },
                select: { supplierId: true },
                distinct: ['supplierId']
            });
            returnSupplierIds = posFromReturns.map(p => p.supplierId);
        }
    }

    // Gộp tất cả
    const ids = new Set([
        ...pos.map(p => p.supplierId),
        ...voucherSupplierIds,
        ...returnSupplierIds
    ]);

    return Array.from(ids);
  }



  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


}

export default new SmartDebtService();