import { Router } from 'express';
// Controller đã được tạo ra để chỉ có các hàm đọc và tự lọc status='active'
import publicCategoryController from '@controllers/cs-category.controller';
import { asyncHandler } from '@middlewares/errorHandler';
// Không cần import validate cho query string nếu Controller xử lý nhẹ
// hoặc nếu có validate, cần import schema tương ứng.

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
    asyncHandler(publicCategoryController.getCategoryById.bind(publicCategoryController))
);



export default router;