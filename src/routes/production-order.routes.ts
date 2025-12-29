import { Router } from 'express';
import productionOrderController from '@controllers/production-order.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createProductionOrderSchema,
  updateProductionOrderSchema,
  startProductionSchema,
  completeProductionSchema,
  cancelProductionSchema,
  productionOrderQuerySchema,
} from '@validators/production-order.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/production-orders - Get all production orders
router.get(
  '/',
  authorize('view_production_orders'),
  validate(productionOrderQuerySchema, 'query'),
  asyncHandler(productionOrderController.getAll.bind(productionOrderController))
);

// GET /api/production-orders/:id - Get production order by ID
router.get(
  '/:id',
  authorize('view_production_orders'),
  asyncHandler(productionOrderController.getById.bind(productionOrderController))
);

// POST /api/production-orders - Create new production order
router.post(
  '/',
  authorize('create_production_order'),
  validate(createProductionOrderSchema),
  logActivityMiddleware('create', 'production_order'),
  asyncHandler(productionOrderController.create.bind(productionOrderController))
);

// PUT /api/production-orders/:id - Update production order
router.put(
  '/:id',
  authorize('update_production_order'),
  validate(updateProductionOrderSchema),
  logActivityMiddleware('update', 'production_order'),
  asyncHandler(productionOrderController.update.bind(productionOrderController))
);

// PUT /api/production-orders/:id/start - Start production
router.put(
  '/:id/start',
  authorize('start_production'),
  validate(startProductionSchema),
  logActivityMiddleware('start', 'production_order'),
  asyncHandler(productionOrderController.start.bind(productionOrderController))
);

// PUT /api/production-orders/:id/complete - Complete production
router.put(
  '/:id/complete',
  authorize('complete_production'),
  validate(completeProductionSchema),
  logActivityMiddleware('complete', 'production_order'),
  asyncHandler(productionOrderController.complete.bind(productionOrderController))
);

// PUT /api/production-orders/:id/cancel - Cancel production order
router.put(
  '/:id/cancel',
  authorize('cancel_production_order'),
  validate(cancelProductionSchema),
  logActivityMiddleware('cancel', 'production_order'),
  asyncHandler(productionOrderController.cancel.bind(productionOrderController))
);

// GET /api/production-orders/:id/wastage - Get wastage report
router.get(
  '/:id/wastage',
  authorize('view_production_reports'),
  asyncHandler(productionOrderController.getWastageReport.bind(productionOrderController))
);

// DELETE /api/production-orders/:id - Delete production order
router.delete(
  '/:id',
  authorize('delete_production_order'),
  logActivityMiddleware('delete', 'production_order'),
  asyncHandler(productionOrderController.delete.bind(productionOrderController))
);

export default router;
