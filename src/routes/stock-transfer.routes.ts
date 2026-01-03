import { Router } from 'express';
import stockTransferController from '@controllers/stock-transfer.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate, validateMultiple } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createTransferSchema,
  updateTransferSchema,
  transferQuerySchema,
  transferIdSchema,
  approveTransferSchema,
  completeTransferSchema,
  cancelTransferSchema,
} from '@validators/stock-transfer.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

// PUT /api/stock-transfers/:id/approve - Approve transfer
router.put(
  '/:id/approve',
  authorize('approve_stock_transfers', 'manage_inventory'),
  validateMultiple({
    params: transferIdSchema,
    body: approveTransferSchema,
  }),
  logActivityMiddleware('approve', 'stock_transfers'),
  asyncHandler(stockTransferController.approve.bind(stockTransferController))
);

// PUT /api/stock-transfers/:id/complete - Complete transfer
router.put(
  '/:id/complete',
  authorize('complete_stock_transfers', 'manage_inventory'),
  validateMultiple({
    params: transferIdSchema,
    body: completeTransferSchema,
  }),
  logActivityMiddleware('complete', 'stock_transfers'),
  asyncHandler(stockTransferController.complete.bind(stockTransferController))
);

// PUT /api/stock-transfers/:id/cancel - Cancel transfer
router.put(
  '/:id/cancel',
  authorize('cancel_stock_transfers', 'manage_inventory'),
  validateMultiple({
    params: transferIdSchema,
    body: cancelTransferSchema,
  }),
  logActivityMiddleware('cancel', 'stock_transfers'),
  asyncHandler(stockTransferController.cancel.bind(stockTransferController))
);

// GET /api/stock-transfers/:id - Get transfer by ID
router.get(
  '/:id',
  authorize('view_stock_transfers', 'view_inventory'),
  validate(transferIdSchema, 'params'),
  asyncHandler(stockTransferController.getById.bind(stockTransferController))
);

// PUT /api/stock-transfers/:id - Update transfer
router.put(
  '/:id',
  authorize('update_stock_transfers', 'manage_inventory'),
  validateMultiple({
    params: transferIdSchema,
    body: updateTransferSchema,
  }),
  logActivityMiddleware('update', 'stock_transfers'),
  asyncHandler(stockTransferController.update.bind(stockTransferController))
);

// DELETE /api/stock-transfers/:id - Delete transfer
router.delete(
  '/:id',
  authorize('delete_stock_transfers', 'manage_inventory'),
  validate(transferIdSchema, 'params'),
  logActivityMiddleware('delete', 'stock_transfers'),
  asyncHandler(stockTransferController.delete.bind(stockTransferController))
);

// GET /api/stock-transfers - Get all transfers
router.get(
  '/',
  authorize('view_stock_transfers', 'view_inventory'),
  validate(transferQuerySchema, 'query'),
  asyncHandler(stockTransferController.getAll.bind(stockTransferController))
);

// POST /api/stock-transfers - Create transfer
router.post(
  '/',
  authorize('create_stock_transfers', 'manage_inventory'),
  validate(createTransferSchema, 'body'),
  logActivityMiddleware('create', 'stock_transfers'),
  asyncHandler(stockTransferController.create.bind(stockTransferController))
);

export default router;
