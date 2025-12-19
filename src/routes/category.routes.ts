import { Router } from 'express';
import categoryController from '@controllers/category.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createCategorySchema,
  updateCategorySchema,
  queryCategoriesSchema,
} from '@validators/category.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

/**
 * GET /api/categories
 * Get all categories with pagination, filters, and search
 * Permission: view_products
 */
router.get(
  '/',
  authorize('view_products'),
  validate(queryCategoriesSchema, 'query'),
  asyncHandler(categoryController.getAllCategories.bind(categoryController))
);

/**
 * GET /api/categories/stats/overview
 * Get category statistics (total, active, inactive, top categories)
 * Permission: view_products
 */
router.get(
  '/stats/overview',
  authorize('view_products'),
  asyncHandler(categoryController.getCategoryStats.bind(categoryController))
);

/**
 * GET /api/categories/tree
 * Get category tree structure (hierarchical)
 * Permission: view_products
 */
router.get(
  '/tree',
  authorize('view_products'),
  asyncHandler(categoryController.getCategoryTree.bind(categoryController))
);

/**
 * GET /api/categories/:id
 * Get category by ID with details
 * Permission: view_products
 */
router.get(
  '/:id',
  authorize('view_products'),
  asyncHandler(categoryController.getCategoryById.bind(categoryController))
);

/**
 * POST /api/categories
 * Create new category
 * Permission: create_product
 */
router.post(
  '/',
  authorize('create_product'),
  validate(createCategorySchema),
  logActivityMiddleware('create', 'category'),
  asyncHandler(categoryController.createCategory.bind(categoryController))
);

/**
 * PUT /api/categories/:id
 * Update category
 * Permission: update_product
 */
router.put(
  '/:id',
  authorize('update_product'),
  validate(updateCategorySchema),
  logActivityMiddleware('update', 'category'),
  asyncHandler(categoryController.updateCategory.bind(categoryController))
);

/**
 * DELETE /api/categories/:id
 * Delete category (soft delete - set inactive)
 * Permission: delete_product
 */
router.delete(
  '/:id',
  authorize('delete_product'),
  logActivityMiddleware('delete', 'category'),
  asyncHandler(categoryController.deleteCategory.bind(categoryController))
);

export default router;
