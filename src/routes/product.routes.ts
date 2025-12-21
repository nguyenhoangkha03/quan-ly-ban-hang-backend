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
  updateFeaturedSchema,
} from '@validators/product.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

/**
 * @swagger
 * /api/products/low-stock:
 *   get:
 *     summary: Get low stock products
 *     tags: [Products]
 *     description: Retrieve products with stock levels below minimum threshold
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Low stock products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       sku:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       currentStock:
 *                         type: number
 *                       minStockLevel:
 *                         type: number
 *                       warehouse:
 *                         type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/AuthenticationError'
 *       403:
 *         $ref: '#/components/responses/AuthorizationError'
 */
router.get(
  '/low-stock',
  authorize('view_inventory', 'view_products'),
  asyncHandler(productController.getLowStock.bind(productController))
);

/**
 * @swagger
 * /api/products/expiring-soon:
 *   get:
 *     summary: Get products expiring soon
 *     tags: [Products]
 *     description: Retrieve products that are approaching expiry date
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look ahead
 *     responses:
 *       200:
 *         description: Expiring products retrieved successfully
 *       401:
 *         $ref: '#/components/responses/AuthenticationError'
 */
router.get(
  '/expiring-soon',
  authorize('view_inventory', 'view_products'),
  asyncHandler(productController.getExpiringSoon.bind(productController))
);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     description: Retrieve a paginated list of products with optional filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - $ref: '#/components/parameters/SortByParam'
 *       - $ref: '#/components/parameters/SortOrderParam'
 *       - in: query
 *         name: productType
 *         schema:
 *           type: string
 *           enum: [raw_material, packaging, finished_product, goods]
 *         description: Filter by product type
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: integer
 *         description: Filter by supplier ID
 *       - $ref: '#/components/parameters/StatusParam'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/SuccessWithPagination'
 *       401:
 *         $ref: '#/components/responses/AuthenticationError'
 */
router.get(
  '/',
  authorize('view_products'),
  validate(productQuerySchema, 'query'),
  asyncHandler(productController.getAll.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     description: Retrieve detailed information about a specific product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     sku:
 *                       type: string
 *                     productName:
 *                       type: string
 *                     productType:
 *                       type: string
 *                       enum: [raw_material, packaging, finished_product, goods]
 *                     category:
 *                       type: object
 *                     supplier:
 *                       type: object
 *                     unit:
 *                       type: string
 *                     purchasePrice:
 *                       type: number
 *                     sellingPriceRetail:
 *                       type: number
 *                     sellingPriceWholesale:
 *                       type: number
 *                     sellingPriceVip:
 *                       type: number
 *                     images:
 *                       type: array
 *                       items:
 *                         type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/:id',
  authorize('view_products'),
  validate(productIdSchema, 'params'),
  asyncHandler(productController.getById.bind(productController))
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product
 *     tags: [Products]
 *     description: Create a new product in the system
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productName
 *               - productType
 *               - unit
 *             properties:
 *               sku:
 *                 type: string
 *                 description: Product SKU (auto-generated if not provided)
 *               productName:
 *                 type: string
 *                 example: Đường trắng tinh khiết
 *               productType:
 *                 type: string
 *                 enum: [raw_material, packaging, finished_product, goods]
 *                 example: raw_material
 *               packagingType:
 *                 type: string
 *                 enum: [bottle, box, bag, label, other]
 *                 description: Only for packaging type products
 *               categoryId:
 *                 type: integer
 *               supplierId:
 *                 type: integer
 *               unit:
 *                 type: string
 *                 example: kg
 *               barcode:
 *                 type: string
 *               weight:
 *                 type: number
 *               dimensions:
 *                 type: string
 *               description:
 *                 type: string
 *               purchasePrice:
 *                 type: number
 *               sellingPriceRetail:
 *                 type: number
 *               sellingPriceWholesale:
 *                 type: number
 *               sellingPriceVip:
 *                 type: number
 *               taxRate:
 *                 type: number
 *                 default: 0
 *               minStockLevel:
 *                 type: number
 *                 default: 0
 *               expiryDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/AuthenticationError'
 *       403:
 *         $ref: '#/components/responses/AuthorizationError'
 */
router.post(
  '/',
  authorize('create_product'),
  validate(createProductSchema, 'body'),
  asyncHandler(productController.create.bind(productController))
);

router.put(
  '/banner-status', 
  authorize('update_product'),
  validate(updateFeaturedSchema, 'body'), // Validate Action & ProductIds
  asyncHandler(productController.updateBannerStatus.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
 *     description: Update an existing product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productName:
 *                 type: string
 *               productType:
 *                 type: string
 *                 enum: [raw_material, packaging, finished_product, goods]
 *               categoryId:
 *                 type: integer
 *               supplierId:
 *                 type: integer
 *               purchasePrice:
 *                 type: number
 *               sellingPriceRetail:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [active, inactive, discontinued]
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put(
  '/:id',
  authorize('update_product'),
  validateMultiple({
    params: productIdSchema,
    body: updateProductSchema,
  }),
  asyncHandler(productController.update.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product
 *     tags: [Products]
 *     description: Delete a product from the system
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  '/:id',
  authorize('delete_product'),
  validate(productIdSchema, 'params'),
  asyncHandler(productController.delete.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}/images:
 *   post:
 *     summary: Upload product images
 *     tags: [Products]
 *     description: Upload one or more images for a product (max 5)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 5
 *               altText:
 *                 type: string
 *               isPrimary:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       400:
 *         description: Invalid file type or size exceeded
 */
router.post(
  '/:id/images',
  authorize('update_product'),
  validate(productIdSchema, 'params'),
  uploadService.getUploadMiddleware().array('images', 5),
  asyncHandler(productController.uploadImages.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}/images/{imageId}:
 *   delete:
 *     summary: Delete product image
 *     tags: [Products]
 *     description: Delete a specific image from a product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Image ID
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  '/:id/images/:imageId',
  authorize('update_product'),
  asyncHandler(productController.deleteImage.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}/images/{imageId}/primary:
 *   patch:
 *     summary: Set primary product image
 *     tags: [Products]
 *     description: Set a specific image as the primary image for a product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Image ID to set as primary
 *     responses:
 *       200:
 *         description: Primary image set successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  '/:id/images/:imageId/primary',
  authorize('update_product'),
  asyncHandler(productController.setPrimaryImage.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}/videos:
 *   post:
 *     summary: Upload product videos
 *     tags: [Products]
 *     description: Upload one or more videos for a product (max 5 videos, 500MB each)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               videos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               videoType:
 *                 type: string
 *                 enum: [demo, tutorial, review, unboxing, promotion, other]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Videos uploaded successfully
 *       400:
 *         description: Invalid file type or size exceeded
 */
router.post(
  '/:id/videos',
  authorize('update_product'),
  validate(productIdSchema, 'params'),
  uploadService.getVideoUploadMiddleware().array('videos', 5),
  asyncHandler(productController.uploadVideos.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}/videos/{videoId}:
 *   delete:
 *     summary: Delete product video
 *     tags: [Products]
 *     description: Delete a specific video from a product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  '/:id/videos/:videoId',
  authorize('update_product'),
  asyncHandler(productController.deleteVideo.bind(productController))
);

/**
 * @swagger
 * /api/products/{id}/videos/{videoId}/primary:
 *   patch:
 *     summary: Set primary product video
 *     tags: [Products]
 *     description: Set a specific video as the primary video for a product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID to set as primary
 *     responses:
 *       200:
 *         description: Primary video set successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  '/:id/videos/:videoId/primary',
  authorize('update_product'),
  asyncHandler(productController.setPrimaryVideo.bind(productController))
);

export default router;
