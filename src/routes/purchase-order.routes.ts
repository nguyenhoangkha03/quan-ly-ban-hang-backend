import { Router } from 'express';
import purchaseOrderController from '@controllers/purchase-order.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate, validateMultiple } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receivePurchaseOrderSchema,
  purchaseOrderQuerySchema,
  purchaseOrderIdSchema,
  approvePurchaseOrderSchema,
  cancelPurchaseOrderSchema,
} from '@validators/purchase-order.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

// POST /api/purchase-orders - Create purchase order
router.post(
  '/',
  authorize('create_purchase_order', 'manage_procurement'),
  validate(createPurchaseOrderSchema, 'body'),
  logActivityMiddleware('create', 'purchase_order'),
  asyncHandler(purchaseOrderController.create.bind(purchaseOrderController))
);

// PUT /api/purchase-orders/:id - Update purchase order
router.put(
  '/:id',
  authorize('update_purchase_order', 'manage_procurement'),
  validateMultiple({
    params: purchaseOrderIdSchema,
    body: updatePurchaseOrderSchema,
  }),
  logActivityMiddleware('update', 'purchase_order'),
  asyncHandler(purchaseOrderController.update.bind(purchaseOrderController))
);

// PUT /api/purchase-orders/:id/approve - Approve purchase order
router.put(
  '/:id/approve',
  authorize('approve_purchase_order', 'manage_procurement'),
  validateMultiple({
    params: purchaseOrderIdSchema,
    body: approvePurchaseOrderSchema,
  }),
  logActivityMiddleware('approve', 'purchase_order'),
  asyncHandler(purchaseOrderController.approve.bind(purchaseOrderController))
);

// PUT /api/purchase-orders/:id/send-email - Send email
router.put(
  '/:id/send-email',
  authorize('sendEmail_purchase_order', 'manage_procurement'),
  validateMultiple({
    params: purchaseOrderIdSchema,
  }),
  logActivityMiddleware('send_email', 'purchase_order'),
  asyncHandler(purchaseOrderController.sendEmail.bind(purchaseOrderController))
);

// PUT /api/purchase-orders/:id/receive - Receive purchase order
router.put(
  '/:id/receive',
  authorize('receive_purchase_order', 'manage_procurement'),
  validateMultiple({
    params: purchaseOrderIdSchema,
    body: receivePurchaseOrderSchema,
  }),
  logActivityMiddleware('receive', 'purchase_order'),
  asyncHandler(purchaseOrderController.receive.bind(purchaseOrderController))
);

// PUT /api/purchase-orders/:id/cancel - Cancel purchase order
router.put(
  '/:id/cancel',
  authorize('cancel_purchase_order', 'manage_procurement'),
  validateMultiple({
    params: purchaseOrderIdSchema,
    body: cancelPurchaseOrderSchema,
  }),
  logActivityMiddleware('cancel', 'purchase_order'),
  asyncHandler(purchaseOrderController.cancel.bind(purchaseOrderController))
);

// DELETE /api/purchase-orders/:id - Delete purchase order
router.delete(
  '/:id',
  authorize('delete_purchase_order', 'manage_procurement'),
  validate(purchaseOrderIdSchema, 'params'),
  logActivityMiddleware('delete', 'purchase_order'),
  asyncHandler(purchaseOrderController.delete.bind(purchaseOrderController))
);

// GET /api/purchase-orders/:id - Get purchase order by ID
router.get(
  '/:id',
  authorize('view_purchase_orders', 'view_procurement'),
  validate(purchaseOrderIdSchema, 'params'),
  asyncHandler(purchaseOrderController.getById.bind(purchaseOrderController))
);

// GET /api/purchase-orders - Get all purchase orders
router.get(
  '/',
  authorize('view_purchase_orders', 'view_procurement'),
  validate(purchaseOrderQuerySchema, 'query'),
  asyncHandler(purchaseOrderController.getAll.bind(purchaseOrderController))
);

export default router;
