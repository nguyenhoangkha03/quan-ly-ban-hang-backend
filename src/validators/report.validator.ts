import { z } from 'zod';

// Revenue report schema
export const revenueReportSchema = z.object({
  query: z.object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    groupBy: z.enum(['day', 'week', 'month', 'year']).optional().default('day'),
    salesChannel: z.enum(['retail', 'wholesale', 'online', 'distributor']).optional(),
    customerId: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
  }),
});

// Inventory report schema
export const inventoryReportSchema = z.object({
  query: z.object({
    warehouseId: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
    categoryId: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
    productType: z
      .enum(['raw_material', 'packaging', 'finished_product', 'goods'])
      .optional(),
    lowStock: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

// Date range schema (common)
export const dateRangeSchema = z.object({
  query: z.object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
});

// Top products schema
export const topProductsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val)),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
});

// Top customers schema
export const topCustomersSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val)),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
});

// Export types
export type RevenueReportInput = z.infer<typeof revenueReportSchema>['query'];
export type InventoryReportInput = z.infer<typeof inventoryReportSchema>['query'];
export type DateRangeInput = z.infer<typeof dateRangeSchema>['query'];
export type TopProductsInput = z.infer<typeof topProductsSchema>['query'];
export type TopCustomersInput = z.infer<typeof topCustomersSchema>['query'];
