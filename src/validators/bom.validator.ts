import { z } from 'zod';

export const bomMaterialItemSchema = z.object({
  materialId: z.number().int().positive('Material ID must be positive'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().optional(),
  materialType: z.enum(['raw_material', 'packaging'], {
    message: 'Material type must be raw_material or packaging',
  }),
  notes: z.string().max(255).optional(),
});

export const createBomSchema = z.object({
  bomCode: z
    .string()
    .min(1, 'BOM code is required')
    .max(50)
    .regex(/^[A-Z0-9-]+$/, 'BOM code must contain only uppercase letters, numbers, and hyphens'),
  finishedProductId: z.number().int().positive('Finished product ID must be positive'),
  version: z.string().max(20).default('1.0'),
  outputQuantity: z.number().positive('Output quantity must be positive'),
  efficiencyRate: z
    .number()
    .min(0, 'Efficiency rate must be at least 0')
    .max(100, 'Efficiency rate cannot exceed 100')
    .default(100),
  productionTime: z.number().int().positive('Production time must be positive').optional(),
  notes: z.string().max(255).optional(),
  materials: z
    .array(bomMaterialItemSchema)
    .min(1, 'At least one material is required')
    .max(100, 'Maximum 100 materials allowed'),
});

export const updateBomSchema = z.object({
  bomCode: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9-]+$/, 'BOM code must contain only uppercase letters, numbers, and hyphens')
    .optional(),
  finishedProductId: z.number().int().positive().optional(),
  version: z.string().max(20).optional(),
  outputQuantity: z.number().positive().optional(),
  efficiencyRate: z.number().min(0).max(100).optional(),
  productionTime: z.number().int().positive().optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
  materials: z.array(bomMaterialItemSchema).min(1).max(100).optional(),
});

export const bomQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  search: z.string().trim().optional(),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
  finishedProductId: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : undefined))
    .pipe(z.number().int().positive().optional()),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const bomIdSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().int().positive('Invalid BOM ID')),
});

export const calculateMaterialsSchema = z.object({
  bomId: z.number().int().positive('BOM ID is required'),
  productionQuantity: z.number().positive('Production quantity must be positive'),
});

export const approveBomSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CreateBomInput = z.infer<typeof createBomSchema>;
export type UpdateBomInput = z.infer<typeof updateBomSchema>;
export type BomQueryInput = z.infer<typeof bomQuerySchema>;
export type CalculateMaterialsInput = z.infer<typeof calculateMaterialsSchema>;
