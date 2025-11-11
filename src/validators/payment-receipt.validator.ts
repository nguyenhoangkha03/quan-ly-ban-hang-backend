import { z } from 'zod';

export const createPaymentReceiptSchema = z.object({
  body: z.object({
    receiptType: z.enum(['sales', 'debt_collection', 'refund', 'other']),
    customerId: z.number().int().positive('Customer ID must be positive'),
    orderId: z.number().int().positive('Order ID must be positive').optional(),
    amount: z.number().positive('Amount must be positive'),
    paymentMethod: z.enum(['cash', 'transfer', 'card']),
    bankName: z.string().max(200).optional(),
    transactionReference: z.string().max(100).optional(),
    receiptDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid receipt date'),
    notes: z.string().max(255).optional(),
  }),
});

export const updatePaymentReceiptSchema = z.object({
  body: z.object({
    receiptType: z.enum(['sales', 'debt_collection', 'refund', 'other']).optional(),
    amount: z.number().positive().optional(),
    paymentMethod: z.enum(['cash', 'transfer', 'card']).optional(),
    bankName: z.string().max(200).optional(),
    transactionReference: z.string().max(100).optional(),
    receiptDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid receipt date')
      .optional(),
    notes: z.string().max(255).optional(),
  }),
});

export const approveReceiptSchema = z.object({
  body: z.object({
    notes: z.string().max(255).optional(),
  }),
});

export const postReceiptSchema = z.object({
  body: z.object({
    notes: z.string().max(255).optional(),
  }),
});

export const paymentReceiptQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    customerId: z.string().regex(/^\d+$/).transform(Number).optional(),
    orderId: z.string().regex(/^\d+$/).transform(Number).optional(),
    receiptType: z.enum(['sales', 'debt_collection', 'refund', 'other']).optional(),
    paymentMethod: z.enum(['cash', 'transfer', 'card']).optional(),
    isPosted: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export type CreatePaymentReceiptInput = z.infer<typeof createPaymentReceiptSchema>['body'];
export type UpdatePaymentReceiptInput = z.infer<typeof updatePaymentReceiptSchema>['body'];
export type ApproveReceiptInput = z.infer<typeof approveReceiptSchema>['body'];
export type PostReceiptInput = z.infer<typeof postReceiptSchema>['body'];
export type PaymentReceiptQueryInput = z.infer<typeof paymentReceiptQuerySchema>['query'];
