import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
// Import Service dành cho Khách hàng
import customerService from '@services/cs-customer.service'; 
import { NotFoundError } from '@utils/errors';
import { UpdateCustomerInput } from '@validators/customer.validator'; // Import type cho update

class CustomerProfileController {
    
    // Helper để lấy ID khách hàng từ token
    private getCustomerId(req: AuthRequest): number {
        const customerId = req.user?.id; 
        if (!customerId) {
             throw new NotFoundError('Customer ID not found in token. Unauthorized.');
        }
        return customerId;
    }

    // ========================================================
    // 1. GET /api/customer/profile - Lấy thông tin hồ sơ
    // ========================================================
    async getProfile(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);

        // Gọi Service method getById, sử dụng ID từ Token
        const customer = await customerService.getById(customerId); 

        return res.status(200).json({
            success: true,
            data: customer,
            timestamp: new Date().toISOString(),
        });
    }

    // ========================================================
    // 2. PUT /api/customer/profile - Cập nhật hồ sơ
    // ========================================================
    async updateProfile(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        const updateData = req.body as UpdateCustomerInput;
        
        // Gọi Service method updateProfile đã được giới hạn (tái sử dụng updateService)
        const customer = await customerService.updateProfile(customerId, updateData);

        return res.status(200).json({
            success: true,
            data: customer,
            message: 'Profile updated successfully',
            timestamp: new Date().toISOString(),
        });
    }
    
    // ========================================================
    // 3. GET /api/customer/debt - Lấy thông tin nợ
    // ========================================================
    async getDebtInfo(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);

        // Gọi Service method getDebtInfo, sử dụng ID từ Token
        const debtInfo = await customerService.getDebtInfo(customerId);

        return res.status(200).json({
            success: true,
            data: debtInfo,
            timestamp: new Date().toISOString(),
        });
    }

    // ========================================================
    // 4. GET /api/customer/orders - Lịch sử đơn hàng
    // ========================================================
    async getOrderHistory(req: AuthRequest, res: Response) {
        const customerId = this.getCustomerId(req);
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        // Gọi Service method getOrderHistory, sử dụng ID từ Token
        const result = await customerService.getOrderHistory(customerId, page, limit);

        return res.status(200).json({
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
        });
    }
    
    // BỎ QUA các phương thức Admin: getAll, create, update, updateCreditLimit, updateStatus, getOverdueDebt, delete
}

export default new CustomerProfileController();