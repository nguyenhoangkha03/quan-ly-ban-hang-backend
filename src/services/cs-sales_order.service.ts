import { PrismaClient, Prisma, SalesChannel } from '@prisma/client';
import { NotFoundError, ValidationError, AuthorizationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import customerService from './customer.service';
import {
    // Import các types từ schema Customer (đã tạo ở bước trước)
    CreateCustomerSalesOrderInput,
    InitiateCustomerPaymentInput,
} from '@validators/cs-sales_order.validator'; 
// Import các types Admin (chỉ dùng cho logic nội bộ)
import { SalesOrderQueryInput } from '@validators/sales-order.validator'; 

const prisma = new PrismaClient();

class CustomerSalesOrderService {
    
    // ========================================================
    // HELPER (Giữ nguyên)
    // ========================================================
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

    // Helper: Kiểm tra quyền sở hữu đơn hàng
    private async checkOrderOwnership(customerId: number, orderId: number) {
        const order = await prisma.salesOrder.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new NotFoundError('Sales order not found');
        }
        
        if (order.customerId !== customerId) {
            throw new AuthorizationError('Access denied. Order does not belong to the customer.');
        }
        return order;
    }


    // ========================================================
    // 1. CREATE ORDER (Dành cho Khách hàng - POST /api/customer/orders)
    // ========================================================
    async createOrder(customerId: number, data: CreateCustomerSalesOrderInput) {
        
        // 1. Validate Customer Status
        const customer = await customerService.getById(customerId);
        if (customer.status !== 'active') {
            throw new ValidationError('Customer must be active to create order');
        }
        // Validate Warehouse/Products (Giữ nguyên logic Admin)
        // ... (Logic kiểm tra Warehouse, Products tồn tại và active) ...

        const productIds = data.items.map((item) => item.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, status: 'active' }, // Luôn lọc active
        });
        
        if (products.length !== productIds.length) {
            throw new NotFoundError('One or more products not found or inactive');
        }
        
        // ... (Logic kiểm tra inventoryShortages - Giữ nguyên) ...
        const inventoryShortages: Array<{
             productName: string; requested: number; available: number;
        }> = [];
        // ... (Chạy vòng lặp kiểm tra tồn kho) ...
        
        // 2. Tính toán tiền (Giữ nguyên logic Admin)
        let subtotal = 0;
        const itemsWithCalculations = data.items.map((item) => {
             // ... (Logic tính toán lineAmount, subtotal) ...
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
            throw new ValidationError(`Paid amount (${paidAmount}) cannot exceed total amount (${totalAmount})`);
        }
        
        // Validate credit limit (Giữ nguyên logic Admin)
        if ((data.paymentMethod === 'credit' || data.paymentMethod === 'installment') && paidAmount < totalAmount) {
             const debtFromThisOrder = totalAmount - paidAmount;
             const newDebt = Number(customer.currentDebt) + debtFromThisOrder;
             if (newDebt > Number(customer.creditLimit)) {
                 throw new ValidationError(
                     `Order exceeds customer credit limit.`
                 );
             }
        }
        
        const orderCode = await this.generateOrderCode();
        
        // 3. Thực hiện Transaction (Tạo đơn hàng và Reserved Inventory)
        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.salesOrder.create({
                data: {
                    orderCode,
                    customerId: customerId, // Lấy từ token
                    warehouseId: data.warehouseId,
                    orderDate: new Date(),
                    salesChannel: SalesChannel.online, // ÉP BUỘC là 'online'
                    totalAmount,
                    discountAmount: data.discountAmount || 0,
                    shippingFee: data.shippingFee || 0,
                    taxAmount: 0, // Cần tính toán lại nếu muốn chính xác
                    paidAmount,
                    paymentMethod: data.paymentMethod,
                    paymentStatus: paidAmount >= totalAmount ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'),
                    orderStatus: 'pending',
                    deliveryAddress: data.deliveryAddress || customer.address,
                    notes: data.notes,
                    createdBy: customerId, // Gán createdBy là ID của Khách hàng
                    details: {
                        // ... (Logic tạo SalesOrderDetail) ...
                        create: itemsWithCalculations.map((item) => ({
                            productId: item.productId,
                            warehouseId: item.warehouseId || data.warehouseId, // Lấy từ item hoặc order level
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discountPercent: item.discountPercent || 0,
                            taxRate: item.taxRate,
                            notes: item.notes,
                        })),
                    },
                },
                // ... include customer, details ...
            });
            
            // 4. Reserve Inventory (Giữ nguyên logic Admin)
            // ... (Logic reserve inventory dùng tx.inventory.update) ...

            return order;
        });

        // logActivity (Bỏ qua logActivity nếu Khách hàng không phải User hệ thống)

        return {
            order: result,
            inventoryShortages: inventoryShortages.length > 0 ? inventoryShortages : undefined,
        };
    }

    // ========================================================
    // 2. GET MY ORDERS (Dành cho Khách hàng)
    // ========================================================
    async getMyOrders(query: SalesOrderQueryInput) {
        // Tái sử dụng getAll Admin nhưng ép buộc customerId
        const customerId = query.customerId; // customerId đã được Controller thêm vào
        
        const {
            page = 1, limit = 20, search, orderStatus, paymentStatus, fromDate, toDate, sortBy = 'createdAt', sortOrder = 'desc',
        } = query;

        const offset = (page - 1) * limit;

        const where: Prisma.SalesOrderWhereInput = {
            customerId, // ÉP BUỘC customerId
            // ... (Giữ nguyên logic where khác, loại bỏ salesChannel vì KH luôn là online)
            ...(orderStatus && { orderStatus }),
            ...(paymentStatus && { paymentStatus }),
            ...(search && {
                OR: [
                    { orderCode: { contains: search } },
                    // BỎ tìm kiếm theo Tên KH/SĐT KH (vì đã có filter customerId)
                ],
            }),
            // ... (Logic fromDate/toDate)
        };

        const [orders, total] = await Promise.all([
            // ... (prisma.salesOrder.findMany - Giảm thiểu include Admin)
            prisma.salesOrder.findMany({
                where,
                include: {
                    details: {
                        select: { productId: true, quantity: true, unitPrice: true },
                    },
                    paymentReceipts: {
                        select: { id: true, amount: true, receiptDate: true, paymentMethod: true },
                    },
                    // Bỏ include creator, approver, warehouse (trừ khi cần thiết cho Khách hàng)
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
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // ========================================================
    // 3. GET ORDER DETAIL (Dành cho Khách hàng)
    // ========================================================
    async getOrderDetail(customerId: number, orderId: number) {
        // Kiểm tra quyền sở hữu đầu tiên
        await this.checkOrderOwnership(customerId, orderId); 

        const order = await prisma.salesOrder.findUnique({
            where: { id: orderId },
            // Giảm thiểu includes Admin
            include: {
                details: {
                    include: { product: { select: { id: true, sku: true, productName: true, unit: true } } },
                },
                paymentReceipts: {
                    select: { id: true, receiptCode: true, amount: true, receiptDate: true, paymentMethod: true, notes: true },
                    orderBy: { receiptDate: 'desc' },
                },
                customer: {
                    select: { id: true, customerName: true, phone: true, address: true, email: true },
                },
                warehouse: true, // Vẫn cần kho xuất hàng
                // Bỏ creator, approver, canceller
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

    // ========================================================
    // 4. INITIATE PAYMENT (Khởi tạo Thanh toán Online)
    // ========================================================
    async initiatePayment(customerId: number, orderId: number, data: InitiateCustomerPaymentInput) {
        const order = await this.checkOrderOwnership(customerId, orderId);

        if (order.orderStatus !== 'pending' && order.orderStatus !== 'preparing') {
             throw new ValidationError(`Payment can only be initiated for PENDING or PREPARING orders. Current status: ${order.orderStatus}`);
        }
        
        const remainingAmount = Number(order.totalAmount) - Number(order.paidAmount);
        
        if (remainingAmount <= 0) {
             throw new ValidationError('Order is already fully paid.');
        }

        // 1. Kiểm tra số tiền yêu cầu thanh toán
        if (data.amount > remainingAmount) {
             throw new ValidationError(`Payment amount (${data.amount}) exceeds remaining amount (${remainingAmount})`);
        }

        // 2. Tạo bản ghi PaymentReceipt tạm thời (trạng thái pending/unverified)
        const receiptCode = `TTKH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now() % 1000}`;
        
        const newReceipt = await prisma.paymentReceipt.create({
             data: {
                 receiptCode,
                 receiptType: 'sales', // Loại phiếu thu
                 customerId: customerId,
                 orderId: orderId,
                 amount: data.amount,
                 receiptDate: new Date(),
                 paymentMethod: data.paymentMethod || 'transfer', // transfer/cash/installment/credit
                 // Trường hợp này cần thêm một trường PaymentMethodDetail (Momo/MBBank) vào model nếu có
                 // Giả sử paymentMethodDetail được lưu trong notes hoặc metadata
                 notes: `INITIATED VIA CUSTOMER APP | Method: ${data.paymentMethodDetail || 'BANK_TRANSFER'} | ${data.notes || ''}`,
                 createdBy: customerId, // Gán ID khách hàng là người khởi tạo
                 isVerified: false, // Quan trọng: Chưa được xác minh (đang chờ webhook)
             }
        });

        // 3. Tương tác với cổng thanh toán (Hàm giả lập)
        const paymentDetails = this.generateQRCodeOrPaymentLink(orderId, newReceipt.amount, data.paymentMethodDetail);

        return {
             receiptId: newReceipt.id,
             paymentReference: receiptCode,
             ...paymentDetails,
        };
    }
    
    // Hàm giả lập (Bạn cần thay thế bằng API Momo/MBBank thật)
    private generateQRCodeOrPaymentLink(orderId: number, amount: number, methodDetail?: string) {
        const baseContent = `Chuyển khoản ${amount} VND cho DH-${orderId}. ND: DH${orderId}`;
        
        if (methodDetail === 'MOMO_QR') {
             return {
                 qrCode: `MOMO_QR_BASE64_FOR_AMOUNT_${amount}`,
                 instructions: `Vui lòng quét mã Momo với nội dung chuyển khoản là 'DH${orderId}'`,
             };
        }
        
        if (methodDetail === 'MBBANK_QR') {
            // Tương tác với API VietQR/MBBank để tạo QR
             return {
                 qrCode: `MBBANK_QR_BASE64_FOR_AMOUNT_${amount}`,
                 instructions: `Quét mã MBBank. Đảm bảo nội dung chuyển khoản chính xác: DH${orderId}`,
             };
        }
        
        return {
            paymentLink: `http://transfer.bank.com/${orderId}?amount=${amount}`,
            instructions: `Thực hiện chuyển khoản ${amount} VND đến tài khoản [X] với nội dung DH${orderId}`,
        }
    }


    // ========================================================
    // 5. CANCEL ORDER (Khách hàng tự hủy)
    // ========================================================
    async customerCancelOrder(orderId: number, customerId: number, reason: string) {
        const order = await this.checkOrderOwnership(customerId, orderId);

        if (order.orderStatus !== 'pending') {
            throw new ValidationError(`Only PENDING orders can be cancelled by the customer. Current status: ${order.orderStatus}`);
        }
        
        // Thực hiện hủy đơn và release reserved inventory
        const result = await prisma.$transaction(async (tx) => {
            // 1. Release Reserved Inventory (Giữ nguyên logic Admin)
            // ... (Logic release reserved quantity) ...

            // 2. Cập nhật trạng thái đơn hàng
            const updatedOrder = await tx.salesOrder.update({
                where: { id: orderId },
                data: {
                    orderStatus: 'cancelled',
                    cancelledBy: customerId, // Khách hàng tự hủy
                    cancelledAt: new Date(),
                    notes: `${order.notes || ''}\n[CUSTOMER CANCELLED] Reason: ${reason}`,
                },
                // ... include ...
            });
            
            // Nếu khách hàng đã thanh toán trước (paidAmount > 0) -> Cần tạo logic HOÀN TIỀN (REFUND) ở đây
            if (Number(order.paidAmount) > 0) {
                 // Gửi cảnh báo/tạo bản ghi Refund/Credit Note
                 logActivity('warning', customerId, 'sales_orders', {
                     action: 'refund_required',
                     message: `Refund of ${order.paidAmount} VND required for cancelled order ${order.orderCode}.`,
                 });
            }

            return updatedOrder;
        });
        
        // logActivity (Bỏ qua)

        return { message: 'Order cancelled successfully. Refund processing initiated if payment was made.' };
    }

    // ========================================================
    // BỎ QUA CÁC HÀM ADMIN: getAll, update, approve, complete, processPayment (Admin version), delete
    // ========================================================
}

export default new CustomerSalesOrderService();