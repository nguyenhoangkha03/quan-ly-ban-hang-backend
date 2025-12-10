import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import salesOrderService from '@services/sales_order.customer.service'; // Import Customer Service
import { ApiResponse } from '@custom-types/common.type';
import { NotFoundError } from '@utils/errors';
import type {
    CreateCustomerSalesOrderInput,
    InitiateCustomerPaymentInput,
} from '@validators/cs-sales_order.validator'; // Dùng validator mới

class CustomerSalesOrderController {

    private getCustomerId(req: AuthRequest): number {
        const customerId = req.user?.id;
        if (!customerId) {
            // Dùng lỗi AuthorizationError hoặc AuthenticationError phù hợp
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

        // Service sẽ tự gán salesChannel: 'online' và customerId
        const result = await salesOrderService.createOrder(customerId, data);

        const response: ApiResponse = {
            success: true,
            data: result.order,
            // Cảnh báo nếu có thiếu hàng (nếu bạn muốn thông báo cho khách hàng)
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
        // Customer chỉ có thể query trên đơn hàng của mình
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

        // Service phải tự kiểm tra quyền sở hữu
        const order = await salesOrderService.getOrderDetail(customerId, orderId);

        return res.status(200).json({
            success: true,
            data: order,
            timestamp: new Date().toISOString(),
        });
    }

    // ========================================================
    // 4. POST /api/customer/orders/:id/payment - KHỞI TẠO THANH TOÁN
    // ========================================================
    async initiatePayment(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        const orderId = parseInt(req.params.id);
        const data = req.body as InitiateCustomerPaymentInput;

        // Service tạo PaymentReceipt tạm thời và trả về thông tin giao dịch (QR Code/Link)
        const paymentInfo = await salesOrderService.initiatePayment(customerId, orderId, data);

        return res.status(200).json({
            success: true,
            data: paymentInfo,
            message: 'Payment initiation successful. Please complete transaction.',
            timestamp: new Date().toISOString(),
        });
    }

    // ========================================================
    // 5. PUT /api/customer/orders/:id/cancel - HỦY ĐƠN HÀNG CỦA KHÁCH HÀNG
    // Khách hàng chỉ được hủy đơn đang 'pending'
    // ========================================================
    async cancelOrder(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        const orderId = parseInt(req.params.id);
        const { reason } = req.body as { reason: string }; // Cần schema validation cho reason

        // Service sẽ kiểm tra quyền sở hữu và trạng thái (chỉ được hủy khi pending)
        const order = await salesOrderService.customerCancelOrder(orderId, customerId, reason);

        return res.status(200).json({
            success: true,
            data: order,
            message: 'Sales order cancelled successfully.',
            timestamp: new Date().toISOString(),
        });
    }

    // BỎ QUA các phương thức Admin: update, approve, complete, processPayment, delete, v.v.
}

export default new CustomerSalesOrderController();