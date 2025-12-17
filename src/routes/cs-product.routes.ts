import { Router } from 'express';
// Giả định import Controller Public
import publicProductController from '@controllers/cs-product.controller';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';

import { productQuerySchema, productIdSchema } from '@validators/product.validator';

const router = Router();

// ==========================================
// PUBLIC PRODUCT ROUTES (Dành cho Khách hàng / Không cần Token)
// ==========================================

/**
 * GET /api/cs/categories
 * Lấy danh sách sản phẩm đang hoạt động (active)
 * Khách hàng có thể tìm kiếm, lọc theo categoryId, productType.
 */
router.get(
    '/',
    validate(productQuerySchema, 'query'),
    asyncHandler(publicProductController.getAll.bind(publicProductController))
);

/**
 * GET /api/public/products/:id
 * Lấy thông tin chi tiết một sản phẩm đang hoạt động.
 */
router.get(
    '/:id',
    validate(productIdSchema, 'params'),
    asyncHandler(publicProductController.getById.bind(publicProductController))
);

export default router;