import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';

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
  // 1. GET ALL (CÓ REDIS CACHE + SUPPORT EMPTY DEBT)
  // =========================================================================
  async getAll(params: DebtQueryParams) {
    // 🟢 BƯỚC 1: TẠO CACHE KEY
    // Dùng hàm sortedQuery để đảm bảo object {page:1, limit:10} giống {limit:10, page:1}
    const queryHash = JSON.stringify(sortedQuery(params));
    
    // 🟢 BƯỚC 2: KIỂM TRA CACHE
    const cachedData = await this.cache.getDebtList(queryHash);
    if (cachedData) {
        console.log(`🚀 Cache Hit: Smart Debt List [${queryHash}]`);
        return cachedData; // Trả về ngay lập tức
    }

    console.log(`🐢 Cache Miss: Querying DB for Debt List...`);
    
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
    const targetYearStr = year ? String(year) : String(new Date().getFullYear());

    // Biến chứa kết quả
    let mappedData: any[] = [];
    let total = 0;

    // =================================================================================
    // 🔹 CASE A: CÓ CHỌN LOẠI CỤ THỂ (CUSTOMER HOẶC SUPPLIER)
    // -> Query từ bảng gốc (Customer/Supplier) để lấy cả những người chưa có công nợ
    // =================================================================================
    if (type === 'customer' || type === 'supplier') {
        
        // 1. Xây dựng bộ lọc cho bảng Entity (Khách/NCC)
        const entityWhere: any = {};

        if (search) {
            entityWhere.OR = type === 'customer' ? [
                { customerName: { contains: search } },
                { customerCode: { contains: search } },
                { phone: { contains: search } }
            ] : [
                { supplierName: { contains: search } },
                { supplierCode: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        if (assignedUserId) {
            entityWhere.assignedUserId = Number(assignedUserId);
        }

        if (type === 'customer' && province) {
            entityWhere.province = { contains: province };
        }

        // Filter Status phức tạp hơn vì nó nằm ở bảng quan hệ (DebtPeriod)
        // Nếu chọn 'paid' -> Lấy cả người không có debtPeriod HOẶC có debtPeriod <= 1000
        // Nếu chọn 'unpaid' -> Chỉ lấy người có debtPeriod > 1000
        if (status) {
            const debtCondition = { periodName: targetYearStr, closingBalance: status === 'paid' ? { lte: 1000 } : { gt: 1000 } };
            
            if (status === 'unpaid') {
                // Bắt buộc phải có debtPeriod thỏa mãn
                entityWhere.debtPeriods = { some: debtCondition };
            } else {
                // 'paid': Có thể không có debtPeriod nào HOẶC có cái thỏa mãn
                entityWhere.OR = [
                    { debtPeriods: { none: { periodName: targetYearStr } } },
                    { debtPeriods: { some: debtCondition } }
                ];
            }
        }

        // 2. Query Database
        // Dùng Dynamic Model (prisma.customer hoặc prisma.supplier)
        const modelDelegate = type === 'customer' ? prisma.customer : prisma.supplier;

        const [entities, count] = await Promise.all([
            (modelDelegate as any).findMany({
                where: entityWhere,
                skip,
                take: Number(limit),
                orderBy: { updatedAt: 'desc' }, // Sắp xếp theo ngày cập nhật hồ sơ
                include: {
                    assignedUser: true,
                    // Quan trọng: Include DebtPeriod của năm hiện tại để lấy số dư
                    debtPeriods: {
                        where: { periodName: targetYearStr },
                        take: 1
                    }
                }
            }),
            (modelDelegate as any).count({ where: entityWhere })
        ]);

        total = count;

        // 3. Map Data (Ghép thông tin Entity + DebtPeriod)
        mappedData = entities.map((e: any) => {
            const debt = e.debtPeriods?.[0]; // Lấy record công nợ nếu có
            const closing = Number(debt?.closingBalance || 0);

            return {
                id: debt?.id || `virtual-${e.id}`, // ID ảo nếu chưa có công nợ
                type,
                objId: e.id,
                code: type === 'customer' ? e.customerCode : e.supplierCode,
                name: type === 'customer' ? e.customerName : e.supplierName,
                phone: e.phone,
                avatar: e.avatarUrl,
                assignedUser: e.assignedUser,
                
                // Số liệu (Nếu không có debt thì = 0)
                periodName: targetYearStr,
                openingBalance: Number(debt?.openingBalance || 0),
                increasingAmount: Number(debt?.increasingAmount || 0),
                decreasingAmount: Number(debt?.decreasingAmount || 0),
                closingBalance: closing,
                
                status: closing > 1000 ? 'unpaid' : 'paid',
                updatedAt: debt?.updatedAt || e.updatedAt,
                notes: debt?.notes || ''
            };
        });

    } else {
        // =================================================================================
        // 🔹 CASE B: KHÔNG CHỌN LOẠI (MASTER VIEW - TẤT CẢ)
        // -> Giữ nguyên logic cũ (Query từ DebtPeriod) để tối ưu hiển thị những người CÓ NỢ
        // =================================================================================
        const where: any = { periodName: targetYearStr };
        
        // ... (Logic build where cũ cho Master View giữ nguyên) ...
        // Copy lại đoạn logic build 'where' cũ của bạn vào đây
        if (search) {
             where.AND = [{
                 OR: [
                   { customer: { customerName: { contains: search } } },
                   { customer: { customerCode: { contains: search } } },
                   { supplier: { supplierName: { contains: search } } },
                   { supplier: { supplierCode: { contains: search } } },
                 ]
             }];
        }
        if (assignedUserId) {
             where.OR = [{ customer: { assignedUserId: Number(assignedUserId) } }, { supplier: { assignedUserId: Number(assignedUserId) } }];
        }
        if (status === 'paid') where.closingBalance = { lte: 1000 };
        else if (status === 'unpaid') where.closingBalance = { gt: 1000 };

        const [periods, count] = await Promise.all([
            prisma.debtPeriod.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { closingBalance: 'desc' },
                include: {
                    customer: { select: { id: true, customerName: true, customerCode: true, phone: true, avatarUrl: true, assignedUser: true } },
                    supplier: { select: { id: true, supplierName: true, supplierCode: true, phone: true, assignedUser: true } }
                }
            }),
            prisma.debtPeriod.count({ where })
        ]);

        total = count;
        
        mappedData = periods.map(p => {
            const isCustomer = !!p.customerId;
            const closing = Number(p.closingBalance);
            return {
                id: p.id,
                type: isCustomer ? 'customer' : 'supplier',
                objId: isCustomer ? p.customerId : p.supplierId,
                code: isCustomer ? p.customer?.customerCode : p.supplier?.supplierCode,
                name: isCustomer ? p.customer?.customerName : p.supplier?.supplierName,
                phone: isCustomer ? p.customer?.phone : p.supplier?.phone,
                avatar: isCustomer ? p.customer?.avatarUrl : null,
                assignedUser: isCustomer ? p.customer?.assignedUser : p.supplier?.assignedUser,
                periodName: p.periodName,
                openingBalance: Number(p.openingBalance),
                increasingAmount: Number(p.increasingAmount),
                decreasingAmount: Number(p.decreasingAmount),
                closingBalance: closing,
                status: closing > 1000 ? 'unpaid' : 'paid',
                updatedAt: p.updatedAt,
                notes: p.notes
            };
        });
    }

    // =========================================================================
    // 4. TÍNH TỔNG (Vẫn dựa vào DebtPeriod để chính xác về số tiền)
    // =========================================================================
    // Lưu ý: Summary chỉ tính trên những gì ĐÃ GHI NHẬN trong DebtPeriod.
    // Những khách hàng chưa có giao dịch (Entity only) thì số tiền = 0 nên không ảnh hưởng tổng.
    
    // Ta cần build lại where cho summary khớp với params hiện tại
    const summaryWhere: any = { periodName: targetYearStr };
    if (type === 'customer') summaryWhere.customerId = { not: null };
    else if (type === 'supplier') summaryWhere.supplierId = { not: null };
    // ... (Áp dụng lại các filter search/status vào summaryWhere tương tự như Case B) ...
    // Để đơn giản và nhanh, bạn có thể copy logic build where của Case B xuống đây dùng chung cho Summary
    if (search) {
        summaryWhere.AND = [{
            OR: [
              { customer: { customerName: { contains: search } } },
              { customer: { customerCode: { contains: search } } },
              { supplier: { supplierName: { contains: search } } },
              { supplier: { supplierCode: { contains: search } } },
            ]
        }];
   }
   if (assignedUserId) {
    summaryWhere.OR = [{ customer: { assignedUserId: Number(assignedUserId) } }, { supplier: { assignedUserId: Number(assignedUserId) } }];
   }
   if (status === 'paid') summaryWhere.closingBalance = { lte: 1000 };
   else if (status === 'unpaid') summaryWhere.closingBalance = { gt: 1000 };
    
    // Tính tổng nhanh
    const agg = await prisma.debtPeriod.aggregate({
      _sum: { openingBalance: true, increasingAmount: true, decreasingAmount: true, closingBalance: true },
      where: summaryWhere // Lưu ý: Cần build where chính xác nếu muốn summary theo search
    });

    const globalSummary = {
      opening: Number(agg._sum.openingBalance || 0),
      increase: Number(agg._sum.increasingAmount || 0),
      payment: Number(agg._sum.decreasingAmount || 0),
      closing: Number(agg._sum.closingBalance || 0),
    };

    const result = {
      data: mappedData,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        summary: globalSummary
      }
    };

    // 🟢 BƯỚC 5: LƯU VÀO CACHE
    await this.cache.setDebtList(queryHash, result);

    return result;
  }

// =========================================================================
  // 2. GET DETAIL (CÓ REDIS CACHE + CÁC TRƯỜNG MỚI)
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
    // Sau này bạn sẽ query DB vào đây
    let returns: any[] = []; 
    let adjustments: any[] = [];

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
        // Có thể thêm tỉnh/thành để hiển thị chi tiết
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
            // Thêm notes để hiển thị lý do
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

      // TODO: Query bảng SalesReturn (Trả hàng bán) nếu có
      // returns = await prisma.salesReturn.findMany(...)

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
      
      // TODO: Query bảng PurchaseReturn (Trả hàng mua) nếu có
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

    const financials = debtPeriod ? {
        opening: Number(debtPeriod.openingBalance),
        increase: Number(debtPeriod.increasingAmount),
        payment: Number(debtPeriod.decreasingAmount),
        
        // ✅ THÊM TRƯỜNG MỚI (Hiện tại mock = 0, sau này lấy từ DB)
        returnAmount: 0, 
        adjustmentAmount: 0,

        closing: Number(debtPeriod.closingBalance),
        status: Number(debtPeriod.closingBalance) > 1000 ? 'unpaid' : 'paid'
    } : {
        opening: 0, increase: 0, payment: 0, returnAmount: 0, adjustmentAmount: 0, closing: 0, status: 'paid'
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
            // ✅ THÊM DANH SÁCH MỚI
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
      let currentOpeningBalance = 0;
      const startOfStartYear = new Date(startYear, 0, 1);

      if (customerId) {
         const prevOrders = await tx.salesOrder.aggregate({
           where: { customerId: Number(customerId), orderDate: { lt: startOfStartYear }, orderStatus: { not: 'cancelled' } },
           _sum: { totalAmount: true }
         });
         const prevReceipts = await tx.paymentReceipt.aggregate({
           where: { customerId: Number(customerId), receiptDate: { lt: startOfStartYear } },
           _sum: { amount: true }
         });
         currentOpeningBalance = Number(prevOrders._sum.totalAmount || 0) - Number(prevReceipts._sum.amount || 0);
      } else if (supplierId) {
         const prevPO = await tx.purchaseOrder.aggregate({
           where: { supplierId: Number(supplierId), orderDate: { lt: startOfStartYear }, status: { not: 'cancelled' } },
           _sum: { totalAmount: true }
         });
         const prevVouchers = await tx.paymentVoucher.aggregate({
           where: { supplierId: Number(supplierId), paymentDate: { lt: startOfStartYear } },
           _sum: { amount: true }
         });
         currentOpeningBalance = Number(prevPO._sum.totalAmount || 0) - Number(prevVouchers._sum.amount || 0);
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
  // 2. SYNC SNAP (Cập nhật nhanh & Xóa Cache)
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
    const endOfYear = new Date(year, 11, 31);

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
        
        if (customerId) {
          const prevOrders = await tx.salesOrder.aggregate({
            where: { customerId: Number(customerId), orderDate: { lt: startOfYear }, orderStatus: { not: 'cancelled' } },
            _sum: { totalAmount: true }
          });
          const prevReceipts = await tx.paymentReceipt.aggregate({
            where: { customerId: Number(customerId), receiptDate: { lt: startOfYear } },
            _sum: { amount: true }
          });
          openingBalance = Number(prevOrders._sum.totalAmount || 0) - Number(prevReceipts._sum.amount || 0);
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

      // 2.3. TÍNH PHÁT SINH TRONG KỲ
      let increasingAmount = 0;
      let decreasingAmount = 0;

      if (customerId) {
        const currOrders = await tx.salesOrder.aggregate({
          where: { customerId: Number(customerId), orderDate: { gte: startOfYear, lte: endOfYear }, orderStatus: { not: 'cancelled' } },
          _sum: { totalAmount: true }
        });
        const currReceipts = await tx.paymentReceipt.aggregate({
          where: { customerId: Number(customerId), receiptDate: { gte: startOfYear, lte: endOfYear } },
          _sum: { amount: true }
        });
        increasingAmount = Number(currOrders._sum.totalAmount || 0);
        decreasingAmount = Number(currReceipts._sum.amount || 0);
      } else if (supplierId) {
        const currPO = await tx.purchaseOrder.aggregate({
          where: { supplierId: Number(supplierId), orderDate: { gte: startOfYear, lte: endOfYear }, status: { not: 'cancelled' } },
          _sum: { totalAmount: true }
        });
        const currVouchers = await tx.paymentVoucher.aggregate({
          where: { supplierId: Number(supplierId), paymentDate: { gte: startOfYear, lte: endOfYear } },
          _sum: { amount: true }
        });
        increasingAmount = Number(currPO._sum.totalAmount || 0);
        decreasingAmount = Number(currVouchers._sum.amount || 0);
      }

      // 2.4. CHỐT SỐ
      const closingBalance = openingBalance + increasingAmount - decreasingAmount;

      let finalNote = notes || '';
      if (calculationMethod === 'AGGREGATE_FALLBACK') {
        const autoNote = `(Tự động tính lại đầu kỳ do thiếu dữ liệu năm ${prevPeriodName})`;
        finalNote = finalNote ? `${finalNote} ${autoNote}` : autoNote;
      }

      // 2.5. LƯU DB
      const whereClause = customerId 
        ? { customerId_periodName: { customerId: Number(customerId), periodName } }
        : { supplierId_periodName: { supplierId: Number(supplierId), periodName } };

      const period = await tx.debtPeriod.upsert({
        where: whereClause,
        update: {
          openingBalance,
          increasingAmount,
          decreasingAmount,
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
          decreasingAmount,
          closingBalance,
          notes: finalNote,
          isLocked: false
        }
      });

      // 2.6. CẬP NHẬT SỐ DƯ BẢNG CHÍNH (Nếu năm hiện tại/tương lai)
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
  // 3. SYNC FULL ALL (Chạy batch)
  // =================================================================
  async syncFullAll(year: number) {
    const targetYear = year || new Date().getFullYear();
    
    console.log(`🚀 [Batch Full] Bắt đầu đồng bộ toàn bộ dữ liệu lịch sử cho năm ${targetYear}...`);
    const start = Date.now();

    // 1. Lấy danh sách ID cần chạy
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
        // Hàm syncFull con đã tự handle transaction và invalidation cho từng item
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

    // 🔥 XÓA CACHE TOÀN CỤC LẦN CUỐI (Để chắc chắn sạch sẽ sau batch job lớn)
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

    // 🔥 XÓA CACHE TOÀN CỤC LẦN CUỐI
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
  // 5. SEND DEBT NOTICE (Gửi thông báo công nợ)
  // =========================================================================
// =========================================================================
  // 5. SEND DEBT NOTICE (Gửi thông báo công nợ)
  // =========================================================================
  async sendDebtNotice(
    params: {
        id: number;                 // ID của Khách hàng hoặc NCC
        type: 'customer' | 'supplier';
        year?: number;              // Nếu có năm -> Gửi biên bản đối chiếu. Nếu không -> Gửi nhắc nợ hiện tại
        customEmail?: string;       // Email nhận (nếu muốn gửi đè)
        message?: string;           // Lời nhắn thêm
        cc?: string[];
    },
    userId: number
  ) {
    const { id, type, year, customEmail } = params;

    // 1. Lấy thông tin Đối tượng (Khách/NCC)
    let recipient: any = null;
    let currentDebt = 0;

    if (type === 'customer') {
        const customer = await prisma.customer.findUnique({ where: { id: Number(id) } });
        if (!customer) throw new NotFoundError('Khách hàng không tồn tại');
        recipient = {
            name: customer.customerName,
            email: customer.email,
            code: customer.customerCode
        };
        currentDebt = Number(customer.currentDebt);
    } else {
        const supplier = await prisma.supplier.findUnique({ where: { id: Number(id) } });
        if (!supplier) throw new NotFoundError('Nhà cung cấp không tồn tại');
        recipient = {
            name: supplier.supplierName,
            email: supplier.email,
            code: supplier.supplierCode
        };
        currentDebt = Number(supplier.totalPayable);
    }

    // 2. Validate Email
    const toEmail = customEmail || recipient.email;
    if (!toEmail) {
        throw new ValidationError(`Đối tượng ${recipient.name} chưa có email. Vui lòng cập nhật hoặc nhập email thủ công.`);
    }

    // 3. Chuẩn bị nội dung Email
    let subject = '';
    const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

    if (year) {
        subject = `[NAM VIỆT] Biên bản đối chiếu công nợ năm ${year} - ${recipient.code}`;
    } else {
        // === TRƯỜNG HỢP B: Gửi Nhắc nợ hiện tại (Current Debt) ===
        subject = `[NAM VIỆT] Thông báo công nợ hiện tại - ${recipient.code}`;
    }

    // 4. Gửi Email (Mock hoặc gọi Service thật)
    // await mailService.send({ to: toEmail, subject, html: htmlContent });
    console.log(`📧 [EMAIL SENT] To: ${toEmail} | Subject: ${subject}`);

    // 5. Ghi Log Hành động
    try {
        const logAction = year ? `Gửi đối chiếu năm ${year}` : `Gửi nhắc nợ hiện tại (${currencyFormatter.format(currentDebt)})`;
         logActivity(
        'EMAIL_DEBT',
        userId,
        type === 'customer' ? 'Customer' : 'Supplier',
        logAction
      ); 
    } catch (e) {
        console.warn("Log activity failed:", e);
    }

    return {
        success: true,
        sentTo: toEmail,
        type: year ? 'PERIOD_REPORT' : 'CURRENT_REMINDER',
        message: `Đã gửi email thành công tới ${toEmail}`
    };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
   * HÀM PRIVATE: Xử lý tính toán và LƯU TRỮ kỳ công nợ
   * (Được gọi trong vòng lặp của syncFull)
   */
  private async _processSinglePeriod(
    tx: Prisma.TransactionClient,
    year: number,
    openingBalance: number, // ✅ QUAN TRỌNG: Nhận số dư từ năm trước chuyển sang
    customerId?: number | null,
    supplierId?: number | null,
    notes?: string
  ) {
    const periodName = `${year}`;
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // =================================================================
    // 1. TÍNH PHÁT SINH TRONG KỲ (Transactions)
    // =================================================================
    let increasingAmount = 0;
    let decreasingAmount = 0;

    if (customerId) {
      // Khách hàng: Tăng = Mua hàng, Giảm = Trả tiền
      const currOrders = await tx.salesOrder.aggregate({
        where: { 
            customerId: Number(customerId), 
            orderDate: { gte: startOfYear, lte: endOfYear }, 
            orderStatus: { not: 'cancelled' } 
        },
        _sum: { totalAmount: true }
      });
      const currReceipts = await tx.paymentReceipt.aggregate({
        where: { 
            customerId: Number(customerId), 
            receiptDate: { gte: startOfYear, lte: endOfYear } 
        },
        _sum: { amount: true }
      });
      increasingAmount = Number(currOrders._sum.totalAmount || 0);
      decreasingAmount = Number(currReceipts._sum.amount || 0);

    } else if (supplierId) {
      // Nhà cung cấp: Tăng = Nhập hàng, Giảm = Chi tiền
      const currPO = await tx.purchaseOrder.aggregate({
        where: { 
            supplierId: Number(supplierId), 
            orderDate: { gte: startOfYear, lte: endOfYear }, 
            status: { not: 'cancelled' } 
        },
        _sum: { totalAmount: true }
      });
      const currVouchers = await tx.paymentVoucher.aggregate({
        where: { 
            supplierId: Number(supplierId), 
            paymentDate: { gte: startOfYear, lte: endOfYear } 
        },
        _sum: { amount: true }
      });
      increasingAmount = Number(currPO._sum.totalAmount || 0);
      decreasingAmount = Number(currVouchers._sum.amount || 0);
    }

    // =================================================================
    // 2. CHỐT SỐ CUỐI KỲ (Closing Balance)
    // =================================================================
    // Công thức: Đầu kỳ + Tăng - Giảm = Cuối kỳ
    const closingBalance = openingBalance + increasingAmount - decreasingAmount;

    // =================================================================
    // 3. LƯU VÀO DATABASE (Bảng DebtPeriod - Để lưu lịch sử)
    // =================================================================
    // Xác định điều kiện tìm kiếm (Unique Key)
    const whereClause = customerId 
        ? { customerId_periodName: { customerId: Number(customerId), periodName } }
        : { supplierId_periodName: { supplierId: Number(supplierId), periodName } };

    // Dữ liệu để tạo mới
    const dataPayload = {
        periodName,
        startTime: startOfYear,
        endTime: endOfYear,
        openingBalance,
        increasingAmount,
        decreasingAmount,
        closingBalance,
        notes: notes || '',
        isLocked: false, // Mặc định chưa khóa sổ
        customerId: customerId ? Number(customerId) : null,
        supplierId: supplierId ? Number(supplierId) : null
    };

    await tx.debtPeriod.upsert({
        where: whereClause,
        update: {
            openingBalance,
            increasingAmount,
            decreasingAmount,
            closingBalance,
            updatedAt: new Date(),
            notes: notes ? notes : undefined
        },
        create: dataPayload
    });

    // =================================================================
    // 4. CẬP NHẬT SỐ DƯ HIỆN TẠI (Vào bảng Customer/Supplier)
    // =================================================================
    // Chỉ update nếu đây là năm hiện tại hoặc tương lai (để đảm bảo số hiển thị là mới nhất)
    const currentYear = new Date().getFullYear();
    if (year >= currentYear) {
        if (customerId) {
            await tx.customer.update({
                where: { id: Number(customerId) },
                data: { 
                    currentDebt: closingBalance, 
                    debtUpdatedAt: new Date() 
                }
            });
        } else if (supplierId) {
            await tx.supplier.update({
                where: { id: Number(supplierId) },
                data: { 
                    totalPayable: closingBalance, 
                    payableUpdatedAt: new Date() 
                }
            });
        }
    }

    // ✅ Trả về số dư cuối kỳ để vòng lặp dùng làm đầu kỳ cho năm sau
    return closingBalance;
  }

// ==========================================
  // PRIVATE HELPERS (Tìm người có giao dịch)
  // ==========================================

  /**
   * Helper: Tìm ID Khách hàng có phát sinh Mua hàng HOẶC Trả tiền trong năm
   */
  private async _getActiveCustomerIds(year: number): Promise<number[]> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // 1. Lấy khách có Đơn hàng (đã chốt hoặc đang giao)
    const orderCustomers = await prisma.salesOrder.findMany({
      where: {
        orderDate: { gte: startOfYear, lte: endOfYear },
        orderStatus: { not: 'cancelled' }
      },
      select: { customerId: true },
      distinct: ['customerId']
    });

    // 2. Lấy khách có Phiếu thu (Trả nợ cũ)
    const paymentCustomers = await prisma.paymentReceipt.findMany({
      where: {
        receiptDate: { gte: startOfYear, lte: endOfYear }
      },
      select: { customerId: true },
      distinct: ['customerId']
    });

    // 3. Gộp và loại bỏ trùng lặp (Dùng Set)
    const uniqueIds = new Set([
      ...orderCustomers.map(i => i.customerId),
      ...paymentCustomers.map(i => i.customerId)
    ]);

    return Array.from(uniqueIds);
  }

  /**
   * Helper: Tìm ID Nhà cung cấp có hoạt động
   */
  private async _getActiveSupplierIds(year: number): Promise<number[]> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const poSuppliers = await prisma.purchaseOrder.findMany({
      where: {
        orderDate: { gte: startOfYear, lte: endOfYear },
        status: { not: 'cancelled' }
      },
      select: { supplierId: true },
      distinct: ['supplierId']
    });

    const voucherSuppliers = await prisma.paymentVoucher.findMany({
      where: {
        paymentDate: { gte: startOfYear, lte: endOfYear }
      },
      select: { supplierId: true },
      distinct: ['supplierId']
    });

    const uniqueIds = new Set([
    ...poSuppliers.map(i => i.supplierId),
    ...voucherSuppliers
        .map(i => i.supplierId)
        .filter((id): id is number => id !== null) 
  ]);

    return Array.from(uniqueIds);
  }



  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


}

export default new SmartDebtService();