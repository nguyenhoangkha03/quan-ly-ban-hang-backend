import { Router } from 'express';
import categoryController from '@controllers/category.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';

import { queryCategoriesSchema } from '@validators/category.validator';


const router = Router();

// All routes require authentication
router.use(authentication);

/**
 * GET /api/cs/categories
 * Get all categories with pagination, filters, and search
 * Permission: view_products
 */
router.get(
  '/cs/',
  authorize('view_products'),
  validate(queryCategoriesSchema, 'query'),
  asyncHandler(categoryController.getAllCategories.bind(categoryController))
);

/**
 * GET /api/cs/categories/tree
 * Get category tree structure (hierarchical)
 * Permission: view_products
 */
router.get(
  '/cs/tree',
  authorize('view_products'),
  asyncHandler(categoryController.getCategoryTree.bind(categoryController))
);

/**
 * GET /api/cs/categories/:id
 * Get category by ID with details
 * Permission: view_products
 */
router.get(
  '/cs/:id',
  authorize('view_products'),
  asyncHandler(categoryController.getCategoryById.bind(categoryController))
);


export default router;
