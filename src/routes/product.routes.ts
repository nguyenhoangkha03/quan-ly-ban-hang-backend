import { Router } from 'express';
import productController from '@controllers/product.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate, validateMultiple } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import uploadService from '@services/upload.service';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  productIdSchema,
} from '@validators/product.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/products/low-stock - Get low stock products
router.get(
  '/low-stock',
  authorize('view_inventory', 'view_products'),
  asyncHandler(productController.getLowStock.bind(productController))
);

// GET /api/products/expiring-soon - Get products expiring soon
router.get(
  '/expiring-soon',
  authorize('view_inventory', 'view_products'),
  asyncHandler(productController.getExpiringSoon.bind(productController))
);

// GET /api/products - Get all products with filters
router.get(
  '/',
  authorize('view_products'),
  validate(productQuerySchema, 'query'),
  asyncHandler(productController.getAll.bind(productController))
);

// GET /api/products/:id - Get product by ID
router.get(
  '/:id',
  authorize('view_products'),
  validate(productIdSchema, 'params'),
  asyncHandler(productController.getById.bind(productController))
);

// POST /api/products - Create new product
router.post(
  '/',
  authorize('create_products'),
  validate(createProductSchema, 'body'),
  asyncHandler(productController.create.bind(productController))
);

// PUT /api/products/:id - Update product
router.put(
  '/:id',
  authorize('update_products'),
  validateMultiple({
    params: productIdSchema,
    body: updateProductSchema,
  }),
  asyncHandler(productController.update.bind(productController))
);

// DELETE /api/products/:id - Delete product
router.delete(
  '/:id',
  authorize('delete_products'),
  validate(productIdSchema, 'params'),
  asyncHandler(productController.delete.bind(productController))
);

// POST /api/products/:id/images - Upload product images
router.post(
  '/:id/images',
  authorize('update_products'),
  validate(productIdSchema, 'params'),
  uploadService.getUploadMiddleware().array('images', 5),
  asyncHandler(productController.uploadImages.bind(productController))
);

// DELETE /api/products/:id/images/:imageId - Delete product image
router.delete(
  '/:id/images/:imageId',
  authorize('update_products'),
  asyncHandler(productController.deleteImage.bind(productController))
);

export default router;
