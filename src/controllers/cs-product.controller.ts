import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
// Giả định bạn đã tạo product.public.service
import productService from '@services/cs-product.service'; 
import { ApiResponse } from '@custom-types/common.type';
import { NotFoundError } from '@utils/errors';

class PublicProductController {
    
    // GET /api/public/products - Lấy danh sách sản phẩm (có filter/search)
    async getAll(req: AuthRequest, res: Response) {
        // Lấy các tham số phân trang/tìm kiếm từ query
        const { page, limit, search, productType, categoryId, supplierId, sortBy, sortOrder } =
            req.query as any;

        // **QUAN TRỌNG:** Ép buộc status luôn là 'active'
        const result = await productService.getAll({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            search,
            productType,
            categoryId: categoryId ? parseInt(categoryId) : undefined,
            supplierId: supplierId ? parseInt(supplierId) : undefined,
            // ÉP BUỘC status='active' (Không cho Khách hàng thay đổi)
            status: 'active', 
            sortBy,
            sortOrder,
        });

        const response: ApiResponse = {
            success: true,
            data: result.products,
            meta: result.pagination,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }

    // GET /api/public/products/:id - Lấy chi tiết sản phẩm
    async getById(req: AuthRequest, res: Response) {
        const { id } = req.params;

        const product = await productService.getById(parseInt(id));
        
        // **QUAN TRỌNG:** Kiểm tra trạng thái sản phẩm phải là active
        if (product.status !== 'active') {
            throw new NotFoundError('Sản phẩm không tồn tại hoặc không khả dụng');
        }

        const response: ApiResponse = {
            success: true,
            data: product,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }

    // BỎ QUA các phương thức sau (chỉ dành cho Admin/CS):
    // create, update, delete, getLowStock, getExpiringSoon, uploadImages, deleteImage, setPrimaryImage, uploadVideos, deleteVideo, setPrimaryVideo
}

export default new PublicProductController();