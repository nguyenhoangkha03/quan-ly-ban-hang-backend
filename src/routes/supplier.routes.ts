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

/**
 * GET /api/suppliers
 * Get all suppliers with pagination, filters, and search
 * Permission: view_products
 */
router.get(
  '/',
  authorize('view_products'),
  validate(querySuppliersSchema, 'query'),
  asyncHandler(supplierController.getAllSuppliers.bind(supplierController))
);

/**
 * GET /api/suppliers/:id
 * Get supplier by ID with details
 * Permission: view_products
 */
router.get(
  '/:id',
  authorize('view_products'),
  asyncHandler(supplierController.getSupplierById.bind(supplierController))
);

/**
 * POST /api/suppliers
 * Create new supplier
 * Permission: create_product
 */
router.post(
  '/',
  authorize('create_product'),
  validate(createSupplierSchema),
  asyncHandler(supplierController.createSupplier.bind(supplierController))
);

/**
 * PUT /api/suppliers/:id
 * Update supplier
 * Permission: update_product
 */
router.put(
  '/:id',
  authorize('update_product'),
  validate(updateSupplierSchema),
  asyncHandler(supplierController.updateSupplier.bind(supplierController))
);

/**
 * DELETE /api/suppliers/:id
 * Delete supplier (soft delete - set inactive)
 * Permission: delete_product
 */
router.delete(
  '/:id',
  authorize('delete_product'),
  asyncHandler(supplierController.deleteSupplier.bind(supplierController))
);

/**
 * GET /api/suppliers/:id/statistics
 * Get supplier statistics (purchase orders, products)
 * Permission: view_products
 */
router.get(
  '/:id/statistics',
  authorize('view_products'),
  asyncHandler(supplierController.getSupplierStatistics.bind(supplierController))
);

export default router;
