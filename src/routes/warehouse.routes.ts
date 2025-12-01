import { Router } from 'express';
import warehouseController from '@controllers/warehouse.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  queryWarehousesSchema,
} from '@validators/warehouse.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

/**
 * GET /api/warehouses
 * Get all warehouses with pagination, filters, and search
 * Permission: view_warehouses
 */
router.get(
  '/',
  authorize('view_warehouses'),
  validate(queryWarehousesSchema, 'query'),
  asyncHandler(warehouseController.getAllWarehouses.bind(warehouseController))
);

/**
 * GET /api/warehouses/:id
 * Get warehouse by ID with details
 * Permission: view_warehouses
 */
router.get(
  '/:id',
  authorize('view_warehouses'),
  asyncHandler(warehouseController.getWarehouseById.bind(warehouseController))
);

/**
 * POST /api/warehouses
 * Create new warehouse
 * Permission: create_warehouse
 * Role: admin, warehouse_manager
 */
router.post(
  '/',
  authorize('create_warehouse'),
  validate(createWarehouseSchema),
  asyncHandler(warehouseController.createWarehouse.bind(warehouseController))
);

/**
 * PUT /api/warehouses/:id
 * Update warehouse
 * Permission: update_warehouse
 * Role: admin, warehouse_manager
 */
router.put(
  '/:id',
  authorize('update_warehouse'),
  validate(updateWarehouseSchema),
  asyncHandler(warehouseController.updateWarehouse.bind(warehouseController))
);

/**
 * DELETE /api/warehouses/:id
 * Delete warehouse (soft delete - set inactive)
 * Permission: delete_warehouse
 * Role: admin only
 */
router.delete(
  '/:id',
  authorize('delete_warehouse'),
  asyncHandler(warehouseController.deleteWarehouse.bind(warehouseController))
);

/**
 * GET /api/warehouses/overview/statistics
 * Get dashboard statistics (total warehouses, active, created this month, total inventory value)
 * Permission: view_warehouses
 */
router.get(
  '/cards/view',
  authorize('view_warehouses'),
  asyncHandler(warehouseController.getWarehouseCards.bind(warehouseController))
);

/**
 * GET /api/warehouses/:id/statistics
 * Get warehouse statistics (inventory, transactions, capacity)
 * Permission: view_warehouses
 */
router.get(
  '/:id/statistics',
  authorize('view_warehouses'),
  asyncHandler(warehouseController.getWarehouseStatistics.bind(warehouseController))
);

export default router;
