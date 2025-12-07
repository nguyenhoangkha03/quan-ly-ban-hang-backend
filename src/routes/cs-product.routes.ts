import { Router } from 'express';
import productController from '@controllers/product.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';

import { productQuerySchema, productIdSchema } from '@validators/product.validator';



const router = Router();

// All routes require authentication
router.use(authentication);

/**
 * @swagger
 * /api/products/cs/low-stock:
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
  '/cs/low-stock',
  authorize('view_inventory', 'view_products'),
  asyncHandler(productController.getLowStock.bind(productController))
);

/**
 * @swagger
 * /api/products/cs/expiring-soon:
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
  '/cs/expiring-soon',
  authorize('view_inventory', 'view_products'),
  asyncHandler(productController.getExpiringSoon.bind(productController))
);

/**
 * @swagger
 * /api/products/cs:
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
  '/cs/',
  authorize('view_products'),
  validate(productQuerySchema, 'query'),
  asyncHandler(productController.getAll.bind(productController))
);

/**
 * @swagger
 * /api/products/cs/{id}:
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
  '/cs/:id',
  authorize('view_products'),
  validate(productIdSchema, 'params'),
  asyncHandler(productController.getById.bind(productController))
);




export default router;
