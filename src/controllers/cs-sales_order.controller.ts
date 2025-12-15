import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import salesOrderService from '@services/cs-sales_order.service';
import { ApiResponse } from '@custom-types/common.type';
import { NotFoundError } from '@utils/errors';
import type {
    CreateCustomerSalesOrderInput,
    InitiateCustomerPaymentInput,
    CustomerCancelOrderInput // Import type cho hủy đơn
} from '@validators/cs-sales_order.validator'; 

class CustomerSalesOrderController {

    private getCustomerId(req: AuthRequest): number {
        const customerId = req.user?.id;
        if (!customerId) {
            // Nên dùng AuthorizationError nếu có, NotFoundError là tạm thời
            throw new NotFoundError('Customer ID not found in token. Unauthorized.');
        }
        return customerId;
    }

    // ========================================================
    // 1. POST /api/customer/orders - TẠO ĐƠN HÀNG MỚI (Khách hàng)
    // ========================================================
    async createOrder(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        const data = req.body as CreateCustomerSalesOrderInput;

        const result = await salesOrderService.createOrder(customerId, data);

        const response: ApiResponse = {
            success: true,
            data: result.order,
            // Cảnh báo nếu có thiếu hàng 
            ...(result.inventoryShortages && {
                warnings: {
                    inventoryShortages: result.inventoryShortages,
                    message: 'Order created but some products have insufficient inventory',
                },
            }),
            message: 'Order created successfully. Proceed to payment.',
            timestamp: new Date().toISOString(),
        };

        // Trả về 201 Created
        return res.status(201).json(response);
    }

    // ========================================================
    // 2. GET /api/customer/orders - Lấy danh sách đơn hàng của MÌNH
    // ========================================================
    async getMyOrders(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        // Gán customerId vào query để Service có thể lọc an toàn
        const query = { ...req.query, customerId } as any; 

        const result = await salesOrderService.getMyOrders(query);

        return res.status(200).json({
            success: true,
            data: result.data,
            meta: result.meta,
            timestamp: new Date().toISOString(),
        });
    }

    // ========================================================
    // 3. GET /api/customer/orders/:id - Chi tiết một đơn hàng của MÌNH
    // ========================================================
    async getMyOrderDetail(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        const orderId = parseInt(req.params.id);

        const order = await salesOrderService.getOrderDetail(customerId, orderId);

        return res.status(200).json({
            success: true,
            data: order,
            timestamp: new Date().toISOString(),
        });
    }

    // ========================================================
    // 4. POST /api/customer/orders/:id/payment - KHỞI TẠO THANH TOÁN (QR/Link)
    // ========================================================
    async initiatePayment(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        const orderId = parseInt(req.params.id);
        const data = req.body as InitiateCustomerPaymentInput;

        // Trả về thông tin QR/Link và Receipt ID
        const paymentInfo = await salesOrderService.initiatePayment(customerId, orderId, data);

        return res.status(200).json({
            success: true,
            data: paymentInfo,
            message: 'Payment initiation successful. Please complete transaction using the provided QR code or link.',
            timestamp: new Date().toISOString(),
        });
    }

    // ========================================================
    // 5. PUT /api/customer/orders/:id/cancel - HỦY ĐƠN HÀNG CỦA KHÁCH HÀNG
    // ========================================================
    async cancelOrder(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        const orderId = parseInt(req.params.id);
        
        // SỬA: Lấy reason từ body sử dụng CustomerCancelOrderInput
        const data = req.body as CustomerCancelOrderInput; 
        
        // Service trả về { order: updatedOrder, message: ... }
        const result = await salesOrderService.customerCancelOrder(orderId, customerId, data); 

        return res.status(200).json({
            success: true,
            data: result.order, // Trả về đơn hàng đã bị hủy
            message: result.message,
            timestamp: new Date().toISOString(),
        });
    }

    // BỎ QUA các phương thức Admin: update, approve, complete, processPayment, delete, v.v.
}

export default new CustomerSalesOrderController();