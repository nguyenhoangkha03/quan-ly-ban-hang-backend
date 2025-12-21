import { Router } from 'express';
import { asyncHandler } from '@middlewares/errorHandler'; // Bắt buộc để bắt lỗi async
import { validateNested } from '@middlewares/validate';
// Middleware xác thực khách hàng (đảm bảo req.user tồn tại)
import { customerAuthentication } from '@middlewares/authCustomer'; 

// Import Controller (đã export default new Controller)
import customerSalesOrderController from '@controllers/cs-sales_order.controller'; 

// Import Validators
import { 
    createCustomerSalesOrderSchema1,
    // initiateCustomerPaymentSchema,
    customerCancelOrderSchema,
    // customerSalesOrderQuerySchema // Import thêm cái này từ bước trước
} from '@validators/cs-sales_order.validator'; 

const router = Router();

// ==========================================
// MIDDLEWARES
// ==========================================
// Áp dụng xác thực cho toàn bộ các routes bên dưới
router.use(customerAuthentication); 


// ==========================================
// ROUTES
// ==========================================

/**
 * @route POST /api/v1/customer/orders
 * @description Tạo đơn hàng mới
 */
router.post(
    '/',
    // Validate BODY
    validateNested(createCustomerSalesOrderSchema1), 
    // Dùng asyncHandler và .bind()
    asyncHandler(customerSalesOrderController.createOrder.bind(customerSalesOrderController))
);

/**
 * @route GET /api/v1/customer/orders
 * @description Xem danh sách đơn hàng của tôi
 */
router.get(
    '/',
    // Validate QUERY params (page, limit, status...)
    // validateNested(customerSalesOrderQuerySchema), 
    asyncHandler(customerSalesOrderController.getMyOrders.bind(customerSalesOrderController))
);

/**
 * @route GET /api/v1/customer/orders/:id
 * @description Xem chi tiết 1 đơn hàng
 */
router.get(
    '/:id',
    // (Optional) Có thể validate params id là số ở đây nếu muốn
    asyncHandler(customerSalesOrderController.getMyOrderDetail.bind(customerSalesOrderController))
);

/**
 * @route POST /api/v1/customer/orders/:id/payment
 * @description Khởi tạo thanh toán Online (lấy QR)
 * Lưu ý: Dùng POST thay vì GET vì có thể gửi kèm thông tin methodDetail trong body
 */
// router.post(
//     '/:id/payment',
//     validateNested(initiateCustomerPaymentSchema),
//     asyncHandler(customerSalesOrderController.initiatePayment.bind(customerSalesOrderController))
// );

// /**
//  * @route PUT /api/v1/customer/orders/:id/cancel
//  * @description Hủy đơn hàng
//  */
router.put(
    '/:id/cancel',
    validateNested(customerCancelOrderSchema),
    asyncHandler(customerSalesOrderController.cancelOrder.bind(customerSalesOrderController))
);

export default router;