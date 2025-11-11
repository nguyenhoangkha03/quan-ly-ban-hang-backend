import { Router } from 'express';
import deliveryController from '@controllers/delivery.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createDeliverySchema,
  updateDeliverySchema,
  startDeliverySchema,
  completeDeliverySchema,
  failDeliverySchema,
  settleCODSchema,
  deliveryQuerySchema,
} from '@validators/delivery.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/deliveries/unsettled-cod - Get unsettled COD (must be before /:id)
router.get(
  '/unsettled-cod',
  authorize('view_delivery_settlement'),
  asyncHandler(deliveryController.getUnsettledCOD.bind(deliveryController))
);

// GET /api/deliveries - Get all deliveries
router.get(
  '/',
  authorize('view_deliveries'),
  validate(deliveryQuerySchema),
  asyncHandler(deliveryController.getAll.bind(deliveryController))
);

// GET /api/deliveries/:id - Get delivery by ID
router.get(
  '/:id',
  authorize('view_deliveries'),
  asyncHandler(deliveryController.getById.bind(deliveryController))
);

// POST /api/deliveries - Create new delivery
router.post(
  '/',
  authorize('create_delivery'),
  validate(createDeliverySchema),
  asyncHandler(deliveryController.create.bind(deliveryController))
);

// PUT /api/deliveries/:id - Update delivery
router.put(
  '/:id',
  authorize('update_delivery'),
  validate(updateDeliverySchema),
  asyncHandler(deliveryController.update.bind(deliveryController))
);

// PUT /api/deliveries/:id/start - Start delivery
router.put(
  '/:id/start',
  authorize('start_delivery'),
  validate(startDeliverySchema),
  asyncHandler(deliveryController.start.bind(deliveryController))
);

// PUT /api/deliveries/:id/complete - Complete delivery
router.put(
  '/:id/complete',
  authorize('complete_delivery'),
  validate(completeDeliverySchema),
  asyncHandler(deliveryController.complete.bind(deliveryController))
);

// PUT /api/deliveries/:id/fail - Fail delivery
router.put(
  '/:id/fail',
  authorize('fail_delivery'),
  validate(failDeliverySchema),
  asyncHandler(deliveryController.fail.bind(deliveryController))
);

// POST /api/deliveries/:id/settle - Settle COD
router.post(
  '/:id/settle',
  authorize('settle_cod'),
  validate(settleCODSchema),
  asyncHandler(deliveryController.settleCOD.bind(deliveryController))
);

// DELETE /api/deliveries/:id - Delete delivery
router.delete(
  '/:id',
  authorize('delete_delivery'),
  asyncHandler(deliveryController.delete.bind(deliveryController))
);

export default router;
