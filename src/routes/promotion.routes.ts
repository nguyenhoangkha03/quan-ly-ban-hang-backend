import { Router } from 'express';
import promotionController from '@controllers/promotion.controller';
// import { authentication } from '@middlewares/auth'; // ❌ Tạm tắt
// import { authorize } from '@middlewares/authorize'; // ❌ Tạm tắt
import { validate, validateNested } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  promotionQuerySchema,
  createPromotionSchema,
  updatePromotionSchema,
  approvePromotionSchema,
  cancelPromotionSchema,
  applyPromotionSchema,
  getActivePromotionsSchema,
} from '@validators/promotion.validator';

const router = Router();

// --- 👇 MOCK AUTH MIDDLEWARE (Dành cho Test) 👇 ---
router.use((req: any, _res, next) => {
    // Giả lập Admin
    req.user = { 
        id: 1, 
        role: 'admin', 
        employeeCode: 'NV-0001',
        fullName: 'Nguyễn Hoàng Kha' 
    }; 
    next();
});
// --------------------------------------------------

// router.use(authentication); // ❌ Tạm tắt

// Lưu ý: Tôi đã tạm comment `authorize` để bạn test thoải mái

// GET /api/promotions - Get all promotions
router.get(
  '/',
  // authorize('view_promotions'),
  validate(promotionQuerySchema, 'query'),
  asyncHandler(promotionController.getAll.bind(promotionController))
);

// GET /api/promotions/active
router.get(
  '/active',
  validate(getActivePromotionsSchema, 'query'),
  asyncHandler(promotionController.getActive.bind(promotionController))
);

// POST /api/promotions/auto-expire
router.post(
  '/auto-expire',
  // authorize('manage_promotions'),
  asyncHandler(promotionController.autoExpire.bind(promotionController))
);

// GET /api/promotions/:id
router.get(
  '/:id',
  // authorize('view_promotions'),
  asyncHandler(promotionController.getById.bind(promotionController))
);

// POST /api/promotions - Create
router.post(
  '/',
  // authorize('create_promotion'),
  validateNested(createPromotionSchema),
  asyncHandler(promotionController.create.bind(promotionController))
);

// PUT /api/promotions/:id
router.put(
  '/:id',
  // authorize('update_promotion'),
  validate(updatePromotionSchema),
  asyncHandler(promotionController.update.bind(promotionController))
);

// PUT /api/promotions/:id/approve
router.put(
  '/:id/approve',
  // authorize('approve_promotion'),
  validateNested(approvePromotionSchema),
  asyncHandler(promotionController.approve.bind(promotionController))
);

// DELETE /api/promotions/:id
router.delete(
  '/:id',
  // authorize('cancel_promotion'),
  validateNested(cancelPromotionSchema),
  asyncHandler(promotionController.cancel.bind(promotionController))
);

// POST /api/promotions/:id/apply - QUAN TRỌNG: Test logic tính tiền
router.post(
  '/:id/apply',
  validateNested(applyPromotionSchema),
  asyncHandler(promotionController.apply.bind(promotionController))
);

export default router;