import { z } from 'zod';

const transactionDetailSchema = z.object({
  productId: z.number().int().positive('Invalid product ID'),
  warehouseId: z.number().int().positive('Invalid warehouse ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').optional(),
  batchNumber: z.string().max(100, 'Batch number too long').optional(),
  expiryDate: z.string().datetime().or(z.date()).optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export const createImportSchema = z.object({
  warehouseId: z.number().int().positive('Invalid warehouse ID'),
  referenceType: z.string().max(50).optional(),
  referenceId: z.number().int().positive().optional(),
  reason: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
  details: z
    .array(transactionDetailSchema)
    .min(1, 'At least one item is required')
    .max(100, 'Maximum 100 items per transaction'),
});

export const createExportSchema = z.object({
  warehouseId: z.number().int().positive('Invalid warehouse ID'),
  referenceType: z.string().max(50).optional(),
  referenceId: z.number().int().positive().optional(),
  reason: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
  details: z
    .array(transactionDetailSchema)
    .min(1, 'At least one item is required')
    .max(100, 'Maximum 100 items per transaction'),
});

export const createTransferSchema = z
  .object({
    sourceWarehouseId: z.number().int().positive('Invalid source warehouse ID'),
    destinationWarehouseId: z.number().int().positive('Invalid destination warehouse ID'),
    reason: z.string().max(255).optional(),
    notes: z.string().max(500).optional(),
    details: z
      .array(transactionDetailSchema)
      .min(1, 'At least one item is required')
      .max(100, 'Maximum 100 items per transaction'),
  })
  .refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: 'Source and destination warehouses must be different',
    path: ['destinationWarehouseId'],
  });

export const createDisposalSchema = z.object({
  warehouseId: z.number().int().positive('Invalid warehouse ID'),
  reason: z.string().min(1, 'Reason is required for disposal').max(255),
  notes: z.string().max(500).optional(),
  details: z
    .array(transactionDetailSchema)
    .min(1, 'At least one item is required')
    .max(100, 'Maximum 100 items per transaction'),
});

export const createStocktakeSchema = z.object({
  warehouseId: z.number().int().positive('Invalid warehouse ID'),
  reason: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
  details: z
    .array(
      z.object({
        productId: z.number().int().positive('Invalid product ID'),
        systemQuantity: z.number().min(0, 'System quantity cannot be negative'),
        actualQuantity: z.number().min(0, 'Actual quantity cannot be negative'),
        batchNumber: z.string().max(100).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one item is required')
    .max(100, 'Maximum 100 items per transaction'),
});

export const transactionQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  transactionType: z.enum(['import', 'export', 'transfer', 'disposal', 'stocktake']).optional(),
  warehouseId: z.string().optional().transform(Number),
  status: z.enum(['draft', 'pending', 'approved', 'cancelled']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const transactionIdSchema = z.object({
  id: z.string().transform(Number),
});

export const approveTransactionSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const cancelTransactionSchema = z.object({
  reason: z.string().min(1, 'Reason is required for cancellation').max(500),
});

export type CreateImportInput = z.infer<typeof createImportSchema>;
export type CreateExportInput = z.infer<typeof createExportSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateDisposalInput = z.infer<typeof createDisposalSchema>;
export type CreateStocktakeInput = z.infer<typeof createStocktakeSchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type TransactionIdInput = z.infer<typeof transactionIdSchema>;
export type ApproveTransactionInput = z.infer<typeof approveTransactionSchema>;
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;
