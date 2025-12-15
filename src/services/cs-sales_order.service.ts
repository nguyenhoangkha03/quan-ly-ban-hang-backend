import { PrismaClient, Prisma, SalesChannel, PaymentMethod, OrderStatus } from '@prisma/client';
import { NotFoundError, ValidationError, AuthorizationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import customerService from './customer.service'; // Giả định service này tồn tại
import {
    CreateCustomerSalesOrderInput,
    InitiateCustomerPaymentInput,
    CustomerCancelOrderInput,
} from '@validators/cs-sales_order.validator';
import { SalesOrderQueryInput } from '@validators/sales-order.validator';


const prisma = new PrismaClient();
const MAX_ORDER_AMOUNT = 30000000; // Giới hạn 30 Triệu VND

// Helper để ánh xạ PaymentMethod (SalesOrder) sang FinancePaymentMethod (Receipt)
// Giả định FinancePaymentMethod chỉ có 'cash' và 'transfer'
const getFinancePaymentMethod = (orderMethod: string): 'cash' | 'transfer' => {
    return orderMethod === 'cash' ? 'cash' : 'transfer';
};

class CustomerSalesOrderService {

    // ========================================================
    // HELPER FUNCTIONS 
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

    private async checkOrderOwnership(customerId: number, orderId: number) {
        const order = await prisma.salesOrder.findUnique({ where: { id: orderId } });
        if (!order) {
            throw new NotFoundError('Sales order not found');
        }
        if (order.customerId !== customerId) {
            throw new AuthorizationError('Access denied. Order does not belong to the customer.');
        }
        return order;
    }

    // Hàm giả lập sinh QR/Link
    private generateQRCodeOrPaymentLink(orderCode: string, amount: number, methodDetail?: string) {
        const amountFormatted = amount.toLocaleString();
        const instructionsCommon = `Vui lòng chuyển khoản chính xác ${amountFormatted} VND. Nội dung bắt buộc: ${orderCode}`;

        if (methodDetail === 'MOMO_QR') {
            return { qrCode: `BASE64_MOMO_QR_FOR_${orderCode}_${amount}`, instructions: `[MOMO] Quét mã QR dưới đây. ${instructionsCommon}.` };
        }
        if (methodDetail === 'MBBANK_QR' || methodDetail === 'BANK_TRANSFER') {
            const bankInfo = `Ngân hàng MBBANK. STK: 88888888888. CTK: CONG TY ABC.`;
            return { qrCode: `BASE64_VIETQR_MBBANK_FOR_${orderCode}_${amount}`, instructions: `[MBBANK] ${bankInfo}. ${instructionsCommon}.` };
        }
        return { qrCode: null, instructions: `[CHUYỂN KHOẢN THƯỜNG] Vui lòng chuyển khoản thủ công. Nội dung: ${orderCode}. Số tiền: ${amountFormatted} VND.` };
    }


    // ========================================================
    // 1. CREATE ORDER (Tạo đơn hàng mới)
    // ========================================================
    async createOrder(customerId: number, data: CreateCustomerSalesOrderInput) {

        // 1. Kiểm tra trạng thái Khách hàng
        const customer = await customerService.getById(customerId);
        if (customer.status !== 'active') {
            throw new ValidationError('Customer must be active to create order');
        }

        // 2. Lấy và kiểm tra Products
        const productIds = data.items.map((item) => item.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, status: 'active' },
            select: { id: true, productName: true, status: true, taxRate: true }
        });

        if (products.length !== productIds.length) {
            throw new NotFoundError('One or more products not found or inactive');
        }

        // 3. Tính toán tiền và chạy kiểm tra tồn kho
        let totalTaxAmount = 0;
        let subtotal = 0;
        const inventoryShortages: Array<{ productName: string; requested: number; available: number; }> = [];

        const itemsToCalculate = data.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            const discountPercent = item.discountPercent || 0;
            const taxRate = product.taxRate || 0;

            const lineTotal = item.quantity * item.unitPrice;
            const discountAmount = lineTotal * (discountPercent / 100);
            const taxableAmount = lineTotal - discountAmount;
            const taxAmount = taxableAmount * (Number(taxRate) / 100);
            const lineAmount = taxableAmount + taxAmount;

            subtotal += lineAmount;
            totalTaxAmount += taxAmount;

            return { ...item, taxRate: Number(taxRate) };
        });

        // 4. KIỂM TRA TỒN KHO TRƯỚC KHI TẠO ĐƠN (Sử dụng prisma global)
        for (const item of itemsToCalculate) {
            const product = products.find((p) => p.id === item.productId)!;
            const warehouseId = item.warehouseId || data.warehouseId;

            if (warehouseId) {
                const inventory = await prisma.inventory.findFirst({
                    where: { productId: item.productId, warehouseId },
                });

                if (inventory) {
                    const available = Number(inventory.quantity) - Number(inventory.reservedQuantity);
                    if (available < item.quantity) {
                        inventoryShortages.push({
                            productName: product.productName,
                            requested: item.quantity,
                            available: available,
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

        if (inventoryShortages.length > 0) {
            throw new ValidationError('Inventory insufficient for the requested order.', {
                shortages: inventoryShortages,
            });
        }

        // 5. Tính toán Final Amount và Paid Amount
        const finalAmount = subtotal + (data.shippingFee || 0) - (data.discountAmount || 0);
        const paidAmount = data.paidAmount || 0;

        // 6. KIỂM TRA GIỚI HẠN 30 TRIỆU
        if (finalAmount > MAX_ORDER_AMOUNT) {
            throw new ValidationError(
                `Order total (${finalAmount.toLocaleString()} VND) exceeds the maximum online limit (${MAX_ORDER_AMOUNT.toLocaleString()} VND). Please contact our company.`
            );
        }

        // 7. Xử lý Trạng thái (Sử dụng Enum)
        let paymentStatus: 'unpaid' | 'partial' | 'paid';
        let orderStatus: OrderStatus = OrderStatus.pending;

        if (paidAmount >= finalAmount) {
            paymentStatus = 'paid';
            orderStatus = OrderStatus.preparing;
        } else if (paidAmount > 0) {
            paymentStatus = 'partial';
        } else {
            paymentStatus = 'unpaid';
        }

        const orderCode = await this.generateOrderCode();

        // 8. Thực hiện Transaction (Tạo đơn hàng và Reserve Inventory)
        const result = await prisma.$transaction(async (tx) => {

            // Data chi tiết đơn hàng (từ itemsToCalculate)
            const itemsToCreate = itemsToCalculate.map((item) => ({
                productId: item.productId,
                warehouseId: item.warehouseId || data.warehouseId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPercent: item.discountPercent || 0,
                taxRate: item.taxRate,
                notes: item.notes,
            }));

            const order = await tx.salesOrder.create({
                data: {
                    orderCode,
                    customerId: customerId,
                    warehouseId: data.warehouseId,
                    orderDate: new Date(),
                    salesChannel: SalesChannel.online,
                    totalAmount: finalAmount,
                    discountAmount: data.discountAmount || 0,
                    shippingFee: data.shippingFee || 0,
                    taxAmount: totalTaxAmount,
                    paidAmount,
                    paymentMethod: data.paymentMethod as PaymentMethod,
                    paymentStatus: paymentStatus,
                    orderStatus: orderStatus,
                    deliveryAddress: data.deliveryAddress || customer.address,
                    notes: data.notes,
                    createdBy: customerId,
                    details: { create: itemsToCreate },
                },
                include: { customer: true, details: { include: { product: true } } },
            });

            // 9. Reserve Inventory (Giảm reservedQuantity)
            for (const item of data.items) {
                const warehouseId = item.warehouseId || data.warehouseId;
                if (warehouseId) {
                    await tx.inventory.updateMany({
                        where: { productId: item.productId, warehouseId: warehouseId },
                        data: {
                            reservedQuantity: { increment: item.quantity },
                        },
                    });
                }
            }

            return order;
        });

        return {
            order: result,
            inventoryShortages: inventoryShortages.length > 0 ? inventoryShortages : undefined,
        };
    }
    // ========================================================
    // 2. GET MY ORDERS (Dành cho Khách hàng)
    // ========================================================
    async getMyOrders(query: SalesOrderQueryInput) {
        const customerId = query.customerId;

        const {
            page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc',
        } = query;

        const offset = (page - 1) * limit;

        const where: Prisma.SalesOrderWhereInput = {
            customerId, // ÉP BUỘC customerId
            // ... (Logic tìm kiếm và filter khác) ...
        };

        const [orders, total] = await Promise.all([
            prisma.salesOrder.findMany({
                where,
                include: {
                    details: {
                        select: { productId: true, quantity: true, unitPrice: true },
                    },
                    paymentReceipts: {
                        select: { id: true, amount: true, receiptDate: true, paymentMethod: true },
                        orderBy: { receiptDate: 'desc' },
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
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // ========================================================
    // 3. GET ORDER DETAIL (Dành cho Khách hàng)
    // ========================================================
    async getOrderDetail(customerId: number, orderId: number) {
        await this.checkOrderOwnership(customerId, orderId);

        const order = await prisma.salesOrder.findUnique({
            where: { id: orderId },
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
                warehouse: true,
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

        if (order.orderStatus !== OrderStatus.pending && order.orderStatus !== OrderStatus.preparing) {
            throw new ValidationError(`Payment can only be initiated for PENDING or PREPARING orders. Current status: ${order.orderStatus}`);
        }

        if (order.paymentMethod !== PaymentMethod.transfer) {
            throw new ValidationError(`Order must have paymentMethod 'transfer' for online payment initiation.`);
        }

        const remainingAmount = Number(order.totalAmount) - Number(order.paidAmount);

        if (remainingAmount <= 0) {
            throw new ValidationError('Order is already fully paid.');
        }

        const amountToPay = data.amount || remainingAmount;

        if (amountToPay > remainingAmount) {
            throw new ValidationError(`Payment amount (${amountToPay}) exceeds remaining amount (${remainingAmount})`);
        }

        const financeMethod = getFinancePaymentMethod(order.paymentMethod);
        const receiptCode = `TTKH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now() % 1000}`;

        const newReceipt = await prisma.paymentReceipt.create({
            data: {
                receiptCode,
                receiptType: 'sales',
                customerId: customerId,
                orderId: orderId,
                amount: amountToPay,
                receiptDate: new Date(),
                paymentMethod: financeMethod,
                notes: `INITIATED VIA CUSTOMER APP | Method: ${data.paymentMethodDetail || 'BANK_TRANSFER'} | ${data.notes || ''}`,
                createdBy: customerId,
                isVerified: false,
            }
        });

        const amountForLink = Number(amountToPay);
        const paymentDetails = this.generateQRCodeOrPaymentLink(order.orderCode, amountForLink, data.paymentMethodDetail);

        return {
            receiptId: newReceipt.id,
            paymentReference: receiptCode,
            amount: amountToPay,
            ...paymentDetails,
        };
    }

    // ========================================================
    // 5. CUSTOMER CANCEL ORDER (Khách hàng tự hủy)
    // ========================================================
    async customerCancelOrder(orderId: number, customerId: number, data: CustomerCancelOrderInput) {
        const order = await this.checkOrderOwnership(customerId, orderId);

        if (order.orderStatus !== OrderStatus.pending) {
            throw new ValidationError(`Only PENDING orders can be cancelled by the customer. Current status: ${order.orderStatus}`);
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Release Reserved Inventory
            // Cần lấy chi tiết đơn hàng để biết sản phẩm và kho cần release
            const orderDetails = await tx.salesOrderDetail.findMany({ where: { orderId } });

            for (const detail of orderDetails) {
                const warehouseId = detail.warehouseId;
                if (warehouseId) {
                    await tx.inventory.updateMany({
                        where: { productId: detail.productId, warehouseId },
                        data: {
                            reservedQuantity: { decrement: detail.quantity },
                        },
                    });
                }
            }

            // 2. Cập nhật trạng thái đơn hàng
            const updatedOrder = await tx.salesOrder.update({
                where: { id: orderId },
                data: {
                    orderStatus: OrderStatus.cancelled,
                    cancelledBy: customerId,
                    cancelledAt: new Date(),
                    notes: `${order.notes || ''}\n[CUSTOMER CANCELLED] Reason: ${data.reason}`,
                },
                include: { customer: true, details: true },
            });

            // 3. Xử lý Hoàn tiền nếu đã trả trước
            if (Number(order.paidAmount) > 0) {
                logActivity('warning', customerId, 'sales_orders', {
                    action: 'refund_required',
                    message: `Refund of ${order.paidAmount} VND required for cancelled order ${order.orderCode}.`,
                });
            }

            return updatedOrder;
        });

        return {
            order: result,
            message: 'Order cancelled successfully. Refund processing initiated if payment was made.'
        };
    }
}

export default new CustomerSalesOrderService();