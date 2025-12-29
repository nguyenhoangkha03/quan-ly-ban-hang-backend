import { Router } from 'express';
// 1. Import Controller Public mới
import publicWarehouseController from '@controllers/cs-warehouse.controller'; 
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
// 2. Import Schema validate (có thể dùng lại của Admin vì input query giống nhau)
import {
  queryWarehousesSchema,
} from '@validators/warehouse.validator';


const router = Router();

/**
 * GET /api/cs/warehouses
 * Lấy danh sách cửa hàng/kho hàng (Store Locator)
 * Quyền hạn: Public (Khách hàng/Guest)
 */
router.get(
  '/',
  validate(queryWarehousesSchema, 'query'),
  asyncHandler(publicWarehouseController.getAllWarehouses.bind(publicWarehouseController))
);


export default router;