import { Router } from 'express';
// Giả định import Controller Public
import publicInventoryController from '@controllers/cs-inventory.controller'; 
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
    checkInventorySchema, 
    getProductAvailabilitySchema,
} from '@validators/inventory.validator';

const router = Router();
/**
 * POST /api/cs/inventory/check
 * Kiểm tra tính khả dụng của các mặt hàng trong giỏ hàng/đơn hàng.
 * API này cần thiết cho luồng mua hàng công khai.
 */
router.post(
    '/check',
    validate(checkInventorySchema, 'body'),
    asyncHandler(publicInventoryController.checkAvailability.bind(publicInventoryController))
);


/**
 * GET /api/cs/inventory/product/:id
 * Lấy danh sách các kho còn hàng cho một sản phẩm cụ thể.
 */
router.get(
    '/product/:id',
    validate(getProductAvailabilitySchema, 'params'), 
    asyncHandler(publicInventoryController.getProductAvailability.bind(publicInventoryController))
);

export default router;