import { z } from 'zod';

export const createPaymentVoucherSchema = z.object({
  body: z
    .object({
      voucherType: z.enum(['salary', 'operating_cost', 'supplier_payment', 'refund', 'other']),
      supplierId: z.number().int().positive('Supplier ID must be positive').optional(),
      expenseAccount: z.string().max(100).optional(),
      amount: z.number().positive('Amount must be positive'),
      paymentMethod: z.enum(['cash', 'transfer']),
      bankName: z.string().max(200).optional(),
      paymentDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid payment date'),
      notes: z.string().max(255).optional(),
    })
    .refine(
      (data) => {
        // Supplier payment must have supplierId
        if (data.voucherType === 'supplier_payment' && !data.supplierId) {
          return false;
        }
        return true;
      },
      {
        message: 'Supplier ID is required for supplier payment vouchers',
      }
    ),
});

export const updatePaymentVoucherSchema = z.object({
  body: z.object({
    voucherType: z
      .enum(['salary', 'operating_cost', 'supplier_payment', 'refund', 'other'])
      .optional(),
    supplierId: z.number().int().positive().optional(),
    expenseAccount: z.string().max(100).optional(),
    amount: z.number().positive().optional(),
    paymentMethod: z.enum(['cash', 'transfer']).optional(),
    bankName: z.string().max(200).optional(),
    paymentDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid payment date')
      .optional(),
    notes: z.string().max(255).optional(),
  }),
});

export const approveVoucherSchema = z.object({
  body: z.object({
    notes: z.string().max(255).optional(),
  }),
});

export const postVoucherSchema = z.object({
  body: z.object({
    notes: z.string().max(255).optional(),
  }),
});

export const paymentVoucherQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    supplierId: z.string().regex(/^\d+$/).transform(Number).optional(),
    voucherType: z
      .enum(['salary', 'operating_cost', 'supplier_payment', 'refund', 'other'])
      .optional(),
    paymentMethod: z.enum(['cash', 'transfer']).optional(),
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

export type CreatePaymentVoucherInput = z.infer<typeof createPaymentVoucherSchema>['body'];
export type UpdatePaymentVoucherInput = z.infer<typeof updatePaymentVoucherSchema>['body'];
export type ApproveVoucherInput = z.infer<typeof approveVoucherSchema>['body'];
export type PostVoucherInput = z.infer<typeof postVoucherSchema>['body'];
export type PaymentVoucherQueryInput = z.infer<typeof paymentVoucherQuerySchema>['query'];
