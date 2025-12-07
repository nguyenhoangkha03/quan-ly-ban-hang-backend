import { Router } from 'express';
// Giả định import Controller Public
import publicInventoryController from '@controllers/cs-inventory.controller'; 
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
    checkInventorySchema, // Import schema cần thiết
} from '@validators/inventory.validator';

const router = Router();

// ==========================================
// PUBLIC INVENTORY ROUTES (Check Availability Only)
// ==========================================

/**
 * POST /api/public/inventory/check
 * Kiểm tra tính khả dụng của các mặt hàng trong giỏ hàng/đơn hàng.
 * API này cần thiết cho luồng mua hàng công khai.
 */
router.post(
    '/check',
    validate(checkInventorySchema, 'body'),
    asyncHandler(publicInventoryController.checkAvailability.bind(publicInventoryController))
);

export default router;