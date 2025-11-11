import { z } from 'zod';

export const createReconciliationSchema = z.object({
  body: z
    .object({
      reconciliationType: z.enum(['monthly', 'quarterly', 'yearly']),
      period: z.string().max(20, 'Period cannot exceed 20 characters'),
      customerId: z.number().int().positive('Customer ID must be positive').optional(),
      supplierId: z.number().int().positive('Supplier ID must be positive').optional(),
      reconciliationDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), 'Invalid reconciliation date'),
      notes: z.string().max(255).optional(),
    })
    .refine(
      (data) => {
        return (data.customerId && !data.supplierId) || (!data.customerId && data.supplierId);
      },
      {
        message: 'Either customerId or supplierId must be provided, but not both',
      }
    ),
});

export const confirmReconciliationSchema = z.object({
  body: z.object({
    confirmedByName: z.string().min(1).max(200),
    confirmedByEmail: z.string().email().max(200),
    discrepancyReason: z.string().max(255).optional(),
    notes: z.string().max(255).optional(),
  }),
});

export const reconciliationQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    customerId: z.string().regex(/^\d+$/).transform(Number).optional(),
    supplierId: z.string().regex(/^\d+$/).transform(Number).optional(),
    reconciliationType: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
    status: z.enum(['pending', 'confirmed', 'disputed']).optional(),
    period: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const sendReconciliationEmailSchema = z.object({
  body: z.object({
    recipientEmail: z.string().email(),
    recipientName: z.string().min(1).max(200),
    message: z.string().max(1000).optional(),
  }),
});
