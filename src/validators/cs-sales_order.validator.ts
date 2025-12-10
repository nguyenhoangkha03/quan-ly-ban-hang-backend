import { z } from 'zod';

// ==========================================
// 1. CREATE SALES ORDER (CUSTOMER VERSION)
// Tự động lấy customerId từ Token. Ép buộc salesChannel là 'online'.
// ==========================================
export const createCustomerSalesOrderSchema = z.object({
    body: z.object({
        // BỎ customerId (lấy từ token)
        // BỎ orderDate (lấy ngày hiện tại)
        // BỎ salesChannel (luôn là 'online')
        warehouseId: z.number().int().positive('Warehouse ID must be positive').optional(),
        paymentMethod: z.enum(['transfer', 'installment', 'credit', 'cash']), // Giữ nguyên các loại thanh toán
        paidAmount: z.number().min(0, 'Paid amount must be non-negative').optional(),
        deliveryAddress: z.string().max(255).optional(),
        discountAmount: z.number().min(0, 'Discount must be non-negative').optional(),
        shippingFee: z.number().min(0, 'Shipping fee must be non-negative').optional(),
        notes: z.string().max(255).optional(),
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
// ==========================================
export const initiateCustomerPaymentSchema = z.object({
    body: z.object({
        // Số tiền khách muốn thanh toán lần này (quan trọng cho trả góp)
        amount: z.number().positive('Amount must be positive'),
        // Phương thức thanh toán chi tiết (Momo, MBBank, VNPAY, v.v.)
        paymentMethodDetail: z.enum(['MOMO_QR', 'MBBANK_QR', 'BANK_TRANSFER']).optional(),
        paymentMethod: z.enum(['transfer', 'cash', 'installment', 'credit']).optional(), // Chỉ để tham chiếu
        notes: z.string().max(255).optional(),
    }),
});

export type CreateCustomerSalesOrderInput = z.infer<typeof createCustomerSalesOrderSchema>['body'];
export type InitiateCustomerPaymentInput = z.infer<typeof initiateCustomerPaymentSchema>['body'];