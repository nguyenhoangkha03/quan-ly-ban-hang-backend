import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
// Giả định bạn tạo service mới cho public
import inventoryService from '@services/cs-inventory.service'; 
import { ApiResponse } from '@custom-types/common.type';

class PublicInventoryController {
    
    // POST /api/public/inventory/check - Kiểm tra tính khả dụng của các mặt hàng
    // Đây là API quan trọng nhất cho Khách hàng (Giỏ hàng/Tạo đơn hàng)
    async checkAvailability(req: AuthRequest, res: Response) {
        // req.body sẽ chứa { items: [{ productId: 1, quantity: 5 }, ...] }
        const { items } = req.body; 

        if (!items || !Array.isArray(items) || items.length === 0) {
             return res.status(400).json({ 
                 success: false, 
                 message: 'Items list is required and must be non-empty.' 
             });
        }
        
        // Service sẽ đảm bảo chỉ kiểm tra tồn kho, không tiết lộ chi tiết warehouse hay minStock
        const result = await inventoryService.checkAvailability(items);

        const response: ApiResponse = {
            success: true,
            data: result,
            message: 'Availability checked successfully',
            timestamp: new Date().toISOString(),
        };

        return res.status(200).json(response);
    }
}

export default new PublicInventoryController();