import { z } from 'zod';

// ==========================================
// 1. CREATE SALES ORDER (CUSTOMER VERSION)
// ==========================================
export const createCustomerSalesOrderSchema = z.object({
    body: z.object({
        // warehouseId: Tùy chọn, nếu Khách hàng không chọn, Service sẽ gán kho mặc định.
        warehouseId: z.number().int().positive('Warehouse ID must be positive').optional(),

        // paymentMethod: Bắt buộc phải là 'transfer' (online) hoặc 'cash' (tiền mặt/COD).
        paymentMethod: z.enum(['transfer', 'cash'])
            .refine((val) => val === 'transfer' || val === 'cash', {
                message: "Payment method must be either 'transfer' (online) or 'cash' (COD)."
            }),

        // paidAmount: Số tiền trả trước. Chỉ được phép nếu thanh toán không phải là ghi nợ/trả góp.
        paidAmount: z.number().min(0, 'Paid amount must be non-negative').optional(),

        // deliveryAddress: Bắt buộc phải có nếu không muốn lấy từ hồ sơ Khách hàng
        deliveryAddress: z.string().max(255).optional(),

        // Các trường tính toán/chiết khấu
        discountAmount: z.number().min(0, 'Discount must be non-negative').optional(),
        shippingFee: z.number().min(0, 'Shipping fee must be non-negative').optional(),
        notes: z.string().max(255).optional(),

        // Chi tiết sản phẩm (Giữ nguyên - Rất tốt)
        items: z
            .array(
                z.object({
                    productId: z.number().int().positive('Product ID must be positive'),
                    quantity: z.number().positive('Quantity must be positive'),
                    unitPrice: z.number().positive('Unit price must be positive'),
                    discountPercent: z.number().min(0).max(100).optional(),
                    taxRate: z.number().min(0).max(100).optional(),
                    warehouseId: z.number().int().positive().optional(),
                    notes: z.string().max(255).optional(),
                })
            )
            .min(1, 'Order must have at least one item'),
    }),
});

// ==========================================
// 2. INITIATE PAYMENT (Khởi tạo thanh toán online)
// API này chỉ được gọi sau khi Khách hàng đã tạo đơn hàng với paymentMethod = 'transfer'.
// ==========================================
export const initiateCustomerPaymentSchema = z.object({
    body: z.object({
        // amount: Tùy chọn, vì Service có thể tự tính toán số tiền còn lại (remainingAmount)
        amount: z.number().positive('Amount must be positive').optional(),

        // paymentMethodDetail: BẮT BUỘC cho thanh toán online.
        paymentMethodDetail: z.enum(['MOMO_QR', 'MBBANK_QR', 'BANK_TRANSFER']
            ).refine((val) => ['MOMO_QR', 'MBBANK_QR', 'BANK_TRANSFER'].includes(val), {
                message: "Payment method detail must be one of 'MOMO_QR', 'MBBANK_QR', or 'BANK_TRANSFER'."
            }),
        notes: z.string().max(255).optional(),
    }),
});

// ==========================================
// 3. CANCEL ORDER (CUSTOMER VERSION)
// ==========================================
export const customerCancelOrderSchema = z.object({
    body: z.object({
        reason: z.string().min(10, 'Cancellation reason must be at least 10 characters').max(255),
    }),
});

// ==========================================
// TYPES
// ==========================================
export type CreateCustomerSalesOrderInput = z.infer<typeof createCustomerSalesOrderSchema>['body'];
export type InitiateCustomerPaymentInput = z.infer<typeof initiateCustomerPaymentSchema>['body'];
export type CustomerCancelOrderInput = z.infer<typeof customerCancelOrderSchema>['body'];