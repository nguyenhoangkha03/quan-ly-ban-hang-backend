import { z } from 'zod';

const transferDetailSchema = z.object({
  productId: z.number().int().positive('Invalid product ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').optional().default(0),
  batchNumber: z.string().max(100, 'Batch number too long').optional(),
  expiryDate: z.string().datetime().or(z.date()).optional(),
  notes: z.string().max(255, 'Notes too long').optional(),
});

export const createTransferSchema = z
  .object({
    fromWarehouseId: z.number().int().positive('Invalid source warehouse ID'),
    toWarehouseId: z.number().int().positive('Invalid destination warehouse ID'),
    transferDate: z.string().datetime().or(z.date()).optional(),
    reason: z.string().max(255, 'Reason too long').optional(),
    details: z
      .array(transferDetailSchema)
      .min(1, 'At least one item is required')
      .max(100, 'Maximum 100 items per transfer'),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: 'Source and destination warehouses must be different',
    path: ['toWarehouseId'],
  });

export const updateTransferSchema = z
  .object({
    fromWarehouseId: z.number().int().positive('Invalid source warehouse ID').optional(),
    toWarehouseId: z.number().int().positive('Invalid destination warehouse ID').optional(),
    transferDate: z.string().datetime().or(z.date()).optional(),
    reason: z.string().max(255).optional(),
    details: z
      .array(transferDetailSchema)
      .min(1, 'At least one item is required')
      .max(100, 'Maximum 100 items per transfer')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.fromWarehouseId && data.toWarehouseId) {
        return data.fromWarehouseId !== data.toWarehouseId;
      }
      return true;
    },
    {
      message: 'Source and destination warehouses must be different',
      path: ['toWarehouseId'],
    }
  );

export const transferQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  search: z.string().trim().optional(),
  fromWarehouseId: z.string().optional().transform(Number),
  toWarehouseId: z.string().optional().transform(Number),
  status: z.enum(['pending', 'in_transit', 'completed', 'cancelled']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const transferIdSchema = z.object({
  id: z.string().transform(Number),
});

export const approveTransferSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const startTransitSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const completeTransferSchema = z.object({
  notes: z.string().max(500).optional(),
  receivedDetails: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        receivedQuantity: z.number().min(0, 'Received quantity cannot be negative'),
        notes: z.string().max(255).optional(),
      })
    )
    .optional(),
});

export const cancelTransferSchema = z.object({
  reason: z.string().min(1, 'Reason is required for cancellation').max(500),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type UpdateTransferInput = z.infer<typeof updateTransferSchema>;
export type TransferQueryInput = z.infer<typeof transferQuerySchema>;
export type TransferIdInput = z.infer<typeof transferIdSchema>;
export type ApproveTransferInput = z.infer<typeof approveTransferSchema>;
export type StartTransitInput = z.infer<typeof startTransitSchema>;
export type CompleteTransferInput = z.infer<typeof completeTransferSchema>;
export type CancelTransferInput = z.infer<typeof cancelTransferSchema>;
