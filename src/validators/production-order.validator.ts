import { z } from 'zod';

export const createProductionOrderSchema = z.object({
  body: z.object({
    bomId: z.number().int().positive('BOM ID must be positive'),
    warehouseId: z.number().int().positive('Warehouse ID must be positive').optional(),
    plannedQuantity: z
      .number()
      .positive('Planned quantity must be positive')
      .refine((val) => val > 0, 'Planned quantity must be greater than 0'),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date'),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid end date')
      .optional(),
    notes: z.string().max(255).optional(),
  }),
});

export const updateProductionOrderSchema = z.object({
  body: z.object({
    plannedQuantity: z.number().positive().optional(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid start date')
      .optional(),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid end date')
      .optional(),
    notes: z.string().max(255).optional(),
  }),
});

export const startProductionSchema = z.object({
  body: z.object({
    notes: z.string().max(255).optional(),
  }),
});

export const completeProductionSchema = z.object({
  body: z.object({
    actualQuantity: z.number().positive('Actual quantity must be positive'),
    notes: z.string().max(255).optional(),
    materials: z
      .array(
        z.object({
          materialId: z.number().int().positive(),
          actualQuantity: z.number().positive(),
          wastage: z.number().min(0).optional(),
          notes: z.string().max(255).optional(),
        })
      )
      .optional(),
  }),
});

export const cancelProductionSchema = z.object({
  body: z.object({
    reason: z.string().min(10, 'Cancellation reason must be at least 10 characters'),
  }),
});

export const productionOrderQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    bomId: z.string().regex(/^\d+$/).transform(Number).optional(),
    warehouseId: z.string().regex(/^\d+$/).transform(Number).optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>['body'];
export type UpdateProductionOrderInput = z.infer<typeof updateProductionOrderSchema>['body'];
export type StartProductionInput = z.infer<typeof startProductionSchema>['body'];
export type CompleteProductionInput = z.infer<typeof completeProductionSchema>['body'];
export type CancelProductionInput = z.infer<typeof cancelProductionSchema>['body'];
export type ProductionOrderQueryInput = z.infer<typeof productionOrderQuerySchema>['query'];
