import { z } from 'zod';

export const publicCategoryQuerySchema = z.object({
  // Phân trang
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  
  // Tìm kiếm
  search: z.string().trim().optional(),
  
  // Lọc theo cha (để lấy danh mục con)
  parentId: z.string().optional().or(z.number().transform(String)), // Chấp nhận cả string và number rồi chuyển về logic xử lý
  
  // Sắp xếp
  sortBy: z.enum(['categoryName', 'createdAt']).default('categoryName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),

  packagingType: z.enum(['finished_product', 'goods', 'bottle', 'box', 'bag', 'label', 'other']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

// ID params validator
export const publicCategoryIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});