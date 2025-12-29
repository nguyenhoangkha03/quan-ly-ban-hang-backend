import { z } from 'zod';

const purchaseOrderDetailSchema = z.object({
  productId: z.number().int().positive('Invalid product ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  notes: z.string().max(255, 'Notes too long').optional(),
});

const updatePurchaseOrderDetailSchema = z.object({
  id: z.number().int().positive().optional(),
  productId: z.number().int().positive('Invalid product ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  notes: z.string().max(255, 'Notes too long').optional(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive('Invalid supplier ID'),
  warehouseId: z.number().int().positive('Invalid warehouse ID'),
  orderDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .or(z.date()),
  expectedDeliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .or(z.date())
    .optional(),
  taxRate: z.number().min(0).max(100, 'Tax rate must be 0-100').default(0),
  notes: z.string().max(255, 'Notes too long').optional(),
  details: z
    .array(purchaseOrderDetailSchema)
    .min(1, 'At least one item is required')
    .max(100, 'Maximum 100 items per purchase order'),
});

export const updatePurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive('Invalid supplier ID').optional(),
  warehouseId: z.number().int().positive('Invalid warehouse ID').optional(),
  orderDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .or(z.date())
    .optional(),
  expectedDeliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .or(z.date())
    .optional(),
  taxRate: z.number().min(0).max(100, 'Tax rate must be 0-100').default(0),
  notes: z.string().max(255, 'Notes too long').optional(),
  details: z
    .array(updatePurchaseOrderDetailSchema)
    .min(1, 'At least one item is required')
    .max(100, 'Maximum 100 items per purchase order')
    .optional(),
});

export const receivePurchaseOrderSchema = z.object({
  details: z
    .array(
      z.object({
        productId: z.number().int().positive('Invalid product ID'),
        quantity: z.number().positive('Quantity must be positive'),
        unitPrice: z.number().min(0, 'Unit price cannot be negative'),
        batchNumber: z.string().max(100, 'Batch number too long').optional(),
        expiryDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
          .or(z.date())
          .optional(),
        notes: z.string().max(500, 'Notes too long').optional(),
      })
    )
    .min(1, 'At least one item is required')
    .max(100, 'Maximum 100 items')
    .optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export const purchaseOrderQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  search: z.string().trim().optional(),
  status: z.enum(['pending', 'approved', 'received', 'cancelled']).optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const purchaseOrderIdSchema = z.object({
  id: z.string().transform(Number),
});

export const approvePurchaseOrderSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const cancelPurchaseOrderSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional(),
});

export type PurchaseOrderQueryInput = z.infer<typeof purchaseOrderQuerySchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type ApprovePurchaseOrderInput = z.infer<typeof approvePurchaseOrderSchema>;
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;
