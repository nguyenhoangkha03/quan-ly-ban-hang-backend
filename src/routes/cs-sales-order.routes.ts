import { Router } from 'express';
// 1. Import Controller
import CustomerSalesOrderController from '@controllers/cs-sales_order.controller'; 
import { customerAuthentication } from '@middlewares/authCustomer'; 
import { validate } from '@middlewares/validate';
// 3. Import Validation Schemas
import { 
    createCustomerSalesOrderSchema,
    initiateCustomerPaymentSchema,
    customerCancelOrderSchema
    // Giả định bạn có một query schema chung cho việc tìm kiếm/phân trang
    // import { salesOrderQuerySchema } 
} from '@validators/cs-sales_order.validator'; 

const router = Router();

// Áp dụng middleware xác thực (authenticate) cho tất cả các routes khách hàng
router.use(customerAuthentication); 

/**
 * @route POST /api/v1/customer/orders
 * @description Khách hàng tạo đơn hàng mới.
 * @access PRIVATE (Customer)
 */
router.post(
    '/',
    validate(createCustomerSalesOrderSchema),
    CustomerSalesOrderController.createOrder
);

/**
 * @route GET /api/v1/customer/orders
 * @description Khách hàng xem danh sách đơn hàng của chính mình (có phân trang/lọc).
 * @access PRIVATE (Customer)
 */
router.get(
    '/',
    // validate(salesOrderQuerySchema), // Dùng schema này nếu bạn muốn validate query params
    CustomerSalesOrderController.getMyOrders
);

/**
 * @route GET /api/v1/customer/orders/:id
 * @description Khách hàng xem chi tiết đơn hàng (chỉ đơn hàng của mình).
 * @access PRIVATE (Customer)
 */
router.get(
    '/:id',
    CustomerSalesOrderController.getMyOrderDetail
);

/**
 * @route PUT /api/v1/customer/orders/:id/cancel
 * @description Khách hàng hủy đơn hàng (chỉ khi trạng thái là PENDING).
 * @access PRIVATE (Customer)
 */
router.put(
    '/:id/cancel',
    validate(customerCancelOrderSchema),
    CustomerSalesOrderController.cancelOrder
);

/**
 * @route POST /api/v1/customer/orders/:id/payment
 * @description Khách hàng khởi tạo thanh toán online (tạo QR/Link thanh toán).
 * @access PRIVATE (Customer)
 */
router.post(
    '/:id/payment',
    validate(initiateCustomerPaymentSchema),
    CustomerSalesOrderController.initiatePayment
);


export default router;