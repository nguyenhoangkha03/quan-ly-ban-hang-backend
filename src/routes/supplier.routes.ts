import { Router } from 'express';
import supplierController from '@controllers/supplier.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createSupplierSchema,
  updateSupplierSchema,
  querySuppliersSchema,
} from '@validators/supplier.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/suppliers
router.get(
  '/',
  authorize('view_products'),
  validate(querySuppliersSchema, 'query'),
  asyncHandler(supplierController.getAllSuppliers.bind(supplierController))
);

// GET /api/suppliers/:id
router.get(
  '/:id',
  authorize('view_products'),
  asyncHandler(supplierController.getSupplierById.bind(supplierController))
);

// POST /api/suppliers
router.post(
  '/',
  authorize('create_product'),
  validate(createSupplierSchema),
  asyncHandler(supplierController.createSupplier.bind(supplierController))
);

// PUT /api/suppliers/:id
router.put(
  '/:id',
  authorize('update_product'),
  validate(updateSupplierSchema),
  asyncHandler(supplierController.updateSupplier.bind(supplierController))
);

// DELETE /api/suppliers/:id
router.delete(
  '/:id',
  authorize('delete_product'),
  asyncHandler(supplierController.deleteSupplier.bind(supplierController))
);

// GET /api/suppliers/:id/statistics
router.get(
  '/:id/statistics',
  authorize('view_products'),
  asyncHandler(supplierController.getSupplierStatistics.bind(supplierController))
);

export default router;
