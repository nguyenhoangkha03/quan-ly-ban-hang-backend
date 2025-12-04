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
  updateInventorySchema,
  adjustInventorySchema,
  reserveInventorySchema,
  releaseReservedSchema,
  alertInventoryQuerySchema,
} from '@validators/inventory.validator';

const router = Router();

// Tất cả các route yêu cầu phải đăng nhập
router.use(authentication);

// GET /api/inventory/alerts - Get cảnh báo tồn kho (tồn kho thấp)
router.get(
  '/alerts',
  authorize('view_inventory'),
  validate(alertInventoryQuerySchema, 'query'),
  asyncHandler(inventoryController.getAlerts.bind(inventoryController))
);

// GET /api/inventory/stats - Get inventory statistics (not affected by pagination)
router.get(
  '/stats',
  authorize('view_inventory'),
  asyncHandler(inventoryController.getStats.bind(inventoryController))
);

// GET /api/inventory/value-report - Get inventory value report
router.get(
  '/value-report',
  authorize('view_inventory', 'view_reports'),
  asyncHandler(inventoryController.getValueReport.bind(inventoryController))
);

// GET /api/inventory/warehouse/:warehouseId - Get inventory by warehouse
router.get(
  '/warehouse/:warehouseId',
  authorize('view_inventory'),
  validate(warehouseInventorySchema, 'params'),
  asyncHandler(inventoryController.getByWarehouse.bind(inventoryController))
);

// GET /api/inventory/product/:productId - Get inventory by product
router.get(
  '/product/:productId',
  authorize('view_inventory'),
  validate(productInventorySchema, 'params'),
  asyncHandler(inventoryController.getByProduct.bind(inventoryController))
);

// POST /api/inventory/check - Check inventory availability
router.post(
  '/check',
  authorize('view_inventory'),
  validate(checkInventorySchema, 'body'),
  asyncHandler(inventoryController.checkAvailability.bind(inventoryController))
);

// POST /api/inventory/reserve - Reserve inventory (for orders)
router.post(
  '/reserve',
  authorize('manage_inventory', 'create_sales_orders', 'create_production_orders'),
  validate(reserveInventorySchema, 'body'),
  asyncHandler(inventoryController.reserve.bind(inventoryController))
);

// POST /api/inventory/release-reserved - Release reserved inventory
router.post(
  '/release-reserved',
  authorize('manage_inventory', 'cancel_sales_orders', 'cancel_production_orders'),
  validate(releaseReservedSchema, 'body'),
  asyncHandler(inventoryController.releaseReserved.bind(inventoryController))
);

// PUT /api/inventory/update - Manual update inventory (admin only)
router.put(
  '/update',
  authorize('manage_inventory'),
  validate(updateInventorySchema, 'body'),
  asyncHandler(inventoryController.update.bind(inventoryController))
);

// POST /api/inventory/adjust - Adjust inventory (increase/decrease)
router.post(
  '/adjust',
  authorize('manage_inventory'),
  validate(adjustInventorySchema, 'body'),
  asyncHandler(inventoryController.adjust.bind(inventoryController))
);

// GET /api/inventory - Get all inventory with filters
router.get(
  '/',
  authorize('view_inventory'),
  validate(inventoryQuerySchema, 'query'),
  asyncHandler(inventoryController.getAll.bind(inventoryController))
);

export default router;
