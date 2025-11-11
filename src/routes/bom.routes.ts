import { Router } from 'express';
import bomController from '@controllers/bom.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate, validateMultiple } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createBomSchema,
  updateBomSchema,
  bomQuerySchema,
  bomIdSchema,
  calculateMaterialsSchema,
  approveBomSchema,
} from '@validators/bom.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// POST /api/bom/calculate - Calculate material requirements
router.post(
  '/calculate',
  authorize('view_bom', 'view_production'),
  validate(calculateMaterialsSchema, 'body'),
  asyncHandler(bomController.calculateMaterials.bind(bomController))
);

// GET /api/bom/product/:productId - Get BOMs by finished product
router.get(
  '/product/:productId',
  authorize('view_bom', 'view_production'),
  asyncHandler(bomController.getByFinishedProduct.bind(bomController))
);

// GET /api/bom - Get all BOMs
router.get(
  '/',
  authorize('view_bom', 'view_production'),
  validate(bomQuerySchema, 'query'),
  asyncHandler(bomController.getAll.bind(bomController))
);

// GET /api/bom/:id - Get BOM by ID
router.get(
  '/:id',
  authorize('view_bom', 'view_production'),
  validate(bomIdSchema, 'params'),
  asyncHandler(bomController.getById.bind(bomController))
);

// POST /api/bom - Create new BOM
router.post(
  '/',
  authorize('create_bom', 'manage_production'),
  validate(createBomSchema, 'body'),
  asyncHandler(bomController.create.bind(bomController))
);

// PUT /api/bom/:id - Update BOM
router.put(
  '/:id',
  authorize('update_bom', 'manage_production'),
  validateMultiple({
    params: bomIdSchema,
    body: updateBomSchema,
  }),
  asyncHandler(bomController.update.bind(bomController))
);

// DELETE /api/bom/:id - Delete BOM
router.delete(
  '/:id',
  authorize('delete_bom', 'manage_production'),
  validate(bomIdSchema, 'params'),
  asyncHandler(bomController.delete.bind(bomController))
);

// PUT /api/bom/:id/approve - Approve BOM
router.put(
  '/:id/approve',
  authorize('approve_bom', 'manage_production'),
  validateMultiple({
    params: bomIdSchema,
    body: approveBomSchema,
  }),
  asyncHandler(bomController.approve.bind(bomController))
);

// PUT /api/bom/:id/inactive - Set BOM to inactive
router.put(
  '/:id/inactive',
  authorize('update_bom', 'manage_production'),
  validate(bomIdSchema, 'params'),
  asyncHandler(bomController.setInactive.bind(bomController))
);

export default router;
