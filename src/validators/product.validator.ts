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
  packagingType: z
    .enum(['bottle', 'box', 'bag', 'label', 'other'])
    .refine((val) => !!val, { message: 'Invalid packaging type' })
    .optional()
    .default('other'),
  categoryId: z.number().int().positive('Invalid category ID').optional(),
  supplierId: z.number().int().positive('Invalid supplier ID').optional(),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit too long').trim(),
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
  expiryDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const date = new Date(val);
      return isNaN(date.getTime()) ? undefined : date.toISOString();
    }),
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
  productType: z
    .enum(['raw_material', 'packaging', 'finished_product', 'goods'])
    .refine((val) => !!val, { message: 'Invalid product type' })
    .optional(),
  packagingType: z
    .enum(['bottle', 'box', 'bag', 'label', 'other'])
    .refine((val) => !!val, { message: 'Invalid packaging type' })
    .optional(),
  categoryId: z.number().int().positive('Invalid category ID').nullable().optional(),
  supplierId: z.number().int().positive('Invalid supplier ID').nullable().optional(),
  unit: z.string().min(1, 'Unit cannot be empty').max(50, 'Unit too long').trim().optional(),
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
  sellingPriceVip: z.number().min(0, 'Giá VIP không thể số âm!').nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  minStockLevel: z.number().min(0).optional(),
  expiryDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => {
      if (!val) return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
});

export const productQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  search: z.string().optional(),
  productType: z
    .enum(['raw_material', 'packaging', 'finished_product', 'goods'])
    .refine((val) => !!val, { message: 'Loại không hợp lệ!' })
    .optional(),
  categoryId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  warehouseId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  supplierId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  status: z
    .enum(['active', 'inactive', 'discontinued'])
    .refine((val) => !!val, { message: 'Trạng thái không hợp lệ!' })
    .optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .refine((val) => !!val, { message: 'Sắp xếp không hợp lệ!' })
    .optional()
    .default('desc'),
});

export const productIdSchema = z.object({
  id: z.string().transform(Number),
});

export const uploadProductImagesSchema = z.object({
  images: z
    .array(
      z.object({
        imageType: z
          .enum(['thumbnail', 'gallery', 'main'])
          .refine((val) => !!val, { message: 'Invalid image type' })
          .optional()
          .default('gallery'),
        altText: z.string().max(255).optional(),
        isPrimary: z.boolean().optional().default(false),
        displayOrder: z.number().int().min(0).optional().default(0),
      })
    )
    .min(1, 'At least one image is required')
    .max(5, 'Maximum 5 images allowed'),
});

export const uploadProductVideosSchema = z.object({
  videos: z
    .array(
      z.object({
        videoType: z
          .enum(['demo', 'tutorial', 'review', 'unboxing', 'promotion', 'other'])
          .refine((val) => !!val, { message: 'Invalid video type' })
          .optional()
          .default('demo'),
        title: z.string().max(255).optional(),
        description: z.string().max(500).optional(),
        isPrimary: z.boolean().optional().default(false),
        displayOrder: z.number().int().min(0).optional().default(0),
      })
    )
    .min(1, 'At least one video is required')
    .max(5, 'Maximum 5 videos allowed'),
});

export const deleteImageSchema = z.object({
  imageId: z.string().transform(Number),
});

export const deleteVideoSchema = z.object({
  videoId: z.string().transform(Number),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductIdInput = z.infer<typeof productIdSchema>;
export type UploadProductImagesInput = z.infer<typeof uploadProductImagesSchema>;
export type UploadProductVideosInput = z.infer<typeof uploadProductVideosSchema>;
export type DeleteImageInput = z.infer<typeof deleteImageSchema>;
export type DeleteVideoInput = z.infer<typeof deleteVideoSchema>;
