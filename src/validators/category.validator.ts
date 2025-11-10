import { z } from 'zod';

export const createCategorySchema = z.object({
  categoryCode: z
    .string()
    .min(1, 'Category code is required')
    .max(50, 'Category code too long')
    .regex(/^[A-Z0-9-]+$/, 'Category code must be uppercase alphanumeric with hyphens')
    .trim(),
  categoryName: z
    .string()
    .min(1, 'Category name is required')
    .max(200, 'Category name too long')
    .trim(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .trim(),
  parentId: z.number().int().positive('Invalid parent category ID').nullable().optional(),
  description: z.string().max(500, 'Description too long').optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateCategorySchema = z.object({
  categoryCode: z
    .string()
    .max(50, 'Category code too long')
    .regex(/^[A-Z0-9-]+$/, 'Category code must be uppercase alphanumeric with hyphens')
    .trim()
    .optional(),
  categoryName: z.string().max(200, 'Category name too long').trim().optional(),
  slug: z
    .string()
    .max(200, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .trim()
    .optional(),
  parentId: z.number().int().positive('Invalid parent category ID').nullable().optional(),
  description: z.string().max(500, 'Description too long').nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const queryCategoriesSchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  search: z.string().trim().optional(),
  parentId: z.string().regex(/^\d+$/).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'categoryName', 'categoryCode'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type QueryCategoriesInput = z.infer<typeof queryCategoriesSchema>;
