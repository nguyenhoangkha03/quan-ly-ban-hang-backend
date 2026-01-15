import { Router } from 'express';
import publicCategoryController from '@controllers/cs-category.controller';
import { asyncHandler } from '@middlewares/errorHandler';
import { publicCategoryQuerySchema } from '@validators/cs-category.validator';
import { validate } from '@middlewares/validate';


const router = Router();

// ==========================================
// PUBLIC CATEGORY ROUTES (Dành cho Khách hàng / Không cần Token)
// ==========================================

/**
 * GET /api/public/categories/
 * Lấy danh sách tất cả danh mục đang hoạt động (active) với phân trang và tìm kiếm.
 */
router.get(
    '/',
    // publicCategoryController.getAllCategories sẽ tự thêm status: 'active' vào query
    validate(publicCategoryQuerySchema, 'query'),
    asyncHandler(publicCategoryController.getAllCategories.bind(publicCategoryController))
);


/**
 * GET /api/public/categories/tree
 * Lấy cấu trúc cây danh mục (chỉ các danh mục active)
 */
router.get(
    '/tree',
    asyncHandler(publicCategoryController.getCategoryTree.bind(publicCategoryController))
);

/**
 * GET /api/public/categories/:id
 * Lấy thông tin chi tiết một danh mục (chỉ danh mục active)
 */
router.get(
    '/:id',
    validate(publicCategoryQuerySchema, 'query'),
    asyncHandler(publicCategoryController.getCategoryById.bind(publicCategoryController))
);



export default router;