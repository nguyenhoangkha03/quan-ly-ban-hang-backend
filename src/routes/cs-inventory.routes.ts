import { Router } from 'express';
import inventoryController from '@controllers/inventory.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  inventoryQuerySchema,
  warehouseInventorySchema,
  productInventorySchema,
  checkInventorySchema,
} from '@validators/inventory.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/inventory/cs/alerts - Get inventory alerts (low stock)
router.get(
  '/cs/alerts',
  authorize('view_inventory'),
  asyncHandler(inventoryController.getAlerts.bind(inventoryController))
);

// GET /api/inventory/cs/low-stock-alerts - Get low stock alerts (alias for /alerts)
router.get(
  '/cs/low-stock-alerts',
  authorize('view_inventory'),
  asyncHandler(inventoryController.getAlerts.bind(inventoryController))
);

// GET /api/inventory/cs/value-report - Get inventory value report
router.get(
  '/cs/value-report',
  authorize('view_inventory', 'view_reports'),
  asyncHandler(inventoryController.getValueReport.bind(inventoryController))
);

// GET /api/inventory/cs/warehouse/:warehouseId - Get inventory by warehouse
router.get(
  '/cs/warehouse/:warehouseId',
  authorize('view_inventory'),
  validate(warehouseInventorySchema, 'params'),
  asyncHandler(inventoryController.getByWarehouse.bind(inventoryController))
);

// GET /api/inventory/cs/product/:productId - Get inventory by product
router.get(
  '/cs/product/:productId',
  authorize('view_inventory'),
  validate(productInventorySchema, 'params'),
  asyncHandler(inventoryController.getByProduct.bind(inventoryController))
);

// POST /api/inventory/cs/check - Check inventory availability
router.post(
  '/cs/check',
  authorize('view_inventory'),
  validate(checkInventorySchema, 'body'),
  asyncHandler(inventoryController.checkAvailability.bind(inventoryController))
);


// GET /api/inventory/cs - Get all inventory with filters
router.get(
  '/cs/',
  authorize('view_inventory'),
  validate(inventoryQuerySchema, 'query'),
  asyncHandler(inventoryController.getAll.bind(inventoryController))
);

export default router;
