import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(50, 'SKU too long')
    .regex(/^[A-Z0-9-]+$/, 'SKU must be alphanumeric uppercase with hyphens')
    .trim()
    .optional(),
  productName: z
    .string()
    .min(1, 'Product name is required')
    .max(200, 'Product name too long')
    .trim(),
  productType: z
    .enum(['raw_material', 'packaging', 'finished_product', 'goods'])
    .refine((val) => !!val, { message: 'Invalid product type' }),
  packagingType: z.enum(['bottle', 'box', 'bag', 'label', 'other']).optional().default('other'),
  categoryId: z.number().int().positive('Invalid category ID').optional(),
  supplierId: z.number().int().positive('Invalid supplier ID').optional(),
  unit: z.string().max(50, 'Unit too long').optional(),
  barcode: z.string().max(100, 'Barcode too long').optional(),
  weight: z.number().positive('Weight must be positive').optional(),
  dimensions: z.string().max(100, 'Dimensions too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative').optional(),
  sellingPriceRetail: z.number().min(0, 'Retail price cannot be negative').optional(),
  sellingPriceWholesale: z.number().min(0, 'Wholesale price cannot be negative').optional(),
  sellingPriceVip: z.number().min(0, 'VIP price cannot be negative').optional(),
  taxRate: z
    .number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .optional()
    .default(0),
  minStockLevel: z.number().min(0, 'Min stock level cannot be negative').optional().default(0),
  expiryDate: z.string().datetime().or(z.date()).optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional().default('active'),
});

export const updateProductSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU cannot be empty')
    .max(50, 'SKU too long')
    .regex(/^[A-Z0-9-]+$/, 'SKU must be alphanumeric uppercase with hyphens')
    .trim()
    .optional(),
  productName: z.string().min(1, 'Product name cannot be empty').max(200).trim().optional(),
  productType: z.enum(['raw_material', 'packaging', 'finished_product', 'goods']).optional(),
  packagingType: z.enum(['bottle', 'box', 'bag', 'label', 'other']).optional(),
  categoryId: z.number().int().positive('Invalid category ID').nullable().optional(),
  supplierId: z.number().int().positive('Invalid supplier ID').nullable().optional(),
  unit: z.string().max(50).optional(),
  barcode: z.string().max(100).nullable().optional(),
  weight: z.number().positive('Weight must be positive').nullable().optional(),
  dimensions: z.string().max(100).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative').nullable().optional(),
  sellingPriceRetail: z.number().min(0, 'Retail price cannot be negative').nullable().optional(),
  sellingPriceWholesale: z
    .number()
    .min(0, 'Wholesale price cannot be negative')
    .nullable()
    .optional(),
  sellingPriceVip: z.number().min(0, 'VIP price cannot be negative').nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  minStockLevel: z.number().min(0).optional(),
  expiryDate: z.string().datetime().or(z.date()).nullable().optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
});

export const productQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  search: z.string().optional(),
  productType: z.enum(['raw_material', 'packaging', 'finished_product', 'goods']).optional(),
  categoryId: z.string().optional().transform(Number),
  supplierId: z.string().optional().transform(Number),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const productIdSchema = z.object({
  id: z.string().transform(Number),
});

export const uploadProductImagesSchema = z.object({
  images: z
    .array(
      z.object({
        imageType: z.enum(['thumbnail', 'gallery', 'main']).optional().default('gallery'),
        altText: z.string().max(255).optional(),
        isPrimary: z.boolean().optional().default(false),
        displayOrder: z.number().int().min(0).optional().default(0),
      })
    )
    .min(1, 'At least one image is required')
    .max(5, 'Maximum 5 images allowed'),
});

export const deleteImageSchema = z.object({
  imageId: z.string().transform(Number),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductIdInput = z.infer<typeof productIdSchema>;
export type UploadProductImagesInput = z.infer<typeof uploadProductImagesSchema>;
export type DeleteImageInput = z.infer<typeof deleteImageSchema>;
