import { z } from 'zod';

export const createSalesOrderSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID must be positive'),
    warehouseId: z.number().int().positive('Warehouse ID must be positive').optional(),
    orderDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid order date')
      .optional(),
    salesChannel: z.enum(['retail', 'wholesale', 'online', 'distributor']).optional(),
    paymentMethod: z.enum(['cash', 'transfer', 'installment', 'credit']),
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
          discountPercent: z.number().min(0).max(100, 'Discount percent must be 0-100').optional(),
          taxRate: z.number().min(0).max(100, 'Tax rate must be 0-100').optional(),
          warehouseId: z.number().int().positive().optional(),
          notes: z.string().max(255).optional(),
        })
      )
      .min(1, 'Order must have at least one item'),
  }),
});

export const updateSalesOrderSchema = z.object({
  body: z.object({
    orderDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid order date')
      .optional(),
    salesChannel: z.enum(['retail', 'wholesale', 'online', 'distributor']).optional(),
    deliveryAddress: z.string().max(255).optional(),
    discountAmount: z.number().min(0).optional(),
    shippingFee: z.number().min(0).optional(),
    notes: z.string().max(255).optional(),
  }),
});

export const approveOrderSchema = z.object({
  body: z.object({
    notes: z.string().max(255).optional(),
  }),
});

export const cancelOrderSchema = z.object({
  body: z.object({
    reason: z.string().min(10, 'Cancellation reason must be at least 10 characters').max(255),
  }),
});

export const processPaymentSchema = z.object({
  body: z.object({
    paidAmount: z.number().positive('Payment amount must be positive'),
    paymentMethod: z.enum(['cash', 'transfer', 'installment', 'credit']),
    notes: z.string().max(255).optional(),
  }),
});

export const salesOrderQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    customerId: z.string().regex(/^\d+$/).transform(Number).optional(),
    orderStatus: z
      .enum(['pending', 'preparing', 'delivering', 'completed', 'cancelled'])
      .optional(),
    paymentStatus: z.enum(['unpaid', 'partial', 'paid']).optional(),
    salesChannel: z.enum(['retail', 'wholesale', 'online', 'distributor']).optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>['body'];
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>['body'];
export type ApproveOrderInput = z.infer<typeof approveOrderSchema>['body'];
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>['body'];
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>['body'];
export type SalesOrderQueryInput = z.infer<typeof salesOrderQuerySchema>['query'];
