import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/common.type';
import inventoryService from '@services/cs-inventory.service'; // Service mới tối ưu

class PublicInventoryController {
    
    /**
     * Kiểm tra tính khả dụng của danh sách sản phẩm (cho Giỏ hàng)
     */
    async checkAvailability(req: AuthRequest, res: Response) {
        const { items } = req.body; 

        // Validation nhanh tại Controller (hoặc dùng middleware validator riêng nếu có)
        if (!items || !Array.isArray(items) || items.length === 0) {
             return res.status(400).json({ 
                 success: false, 
                 message: 'Danh sách sản phẩm không hợp lệ (items phải là mảng và không rỗng).' 
             });
        }
        
        // Gọi Service
        const result = await inventoryService.checkAvailability(items);

        const response: ApiResponse = {
            success: true,
            data: result,
            message: 'Kiểm tra tồn kho hoàn tất.',
            timestamp: new Date().toISOString(),
        };

        return res.status(200).json(response);
    }

    /**
     * Lấy danh sách các kho còn hàng cho 1 sản phẩm cụ thể
     */
     async getProductAvailability(req: AuthRequest, res: Response) {
        const productId = parseInt(req.params.id);
        
        if (isNaN(productId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Product ID không hợp lệ.' 
            });
        }

        // Gọi Service (Service sẽ throw NotFoundError nếu không tìm thấy, asyncHandler sẽ bắt lỗi này)
        const result = await inventoryService.getProductAvailability(productId);

        const response: ApiResponse = {
            success: true,
            data: result,
            message: 'Lấy thông tin kho hàng thành công.',
            timestamp: new Date().toISOString(),
        };

        return res.status(200).json(response);
    }
}

export default new PublicInventoryController();