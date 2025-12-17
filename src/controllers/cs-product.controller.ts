import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
// Giả định bạn đã tạo product.public.service
import productService from '@services/cs-product.service'; 
import { ApiResponse } from '@custom-types/common.type';

class PublicProductController {
    
    // GET /api/cs/categories - Lấy danh sách sản phẩm (có filter/search/pagination/sorting/status)
     async getAll(req: AuthRequest, res: Response) {
       const { page, limit, search, productType, categoryId, supplierId, sortBy, sortOrder } =
         req.query as any;
   
       const result = await productService.getAll({
         page: parseInt(page) || 1,
         limit: parseInt(limit) || 20,
         search,
         productType,
         categoryId: categoryId ? parseInt(categoryId) : undefined,
         supplierId: supplierId ? parseInt(supplierId) : undefined,
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
   
     // GET /api/products/:id
     async getById(req: AuthRequest, res: Response) {
       const { id } = req.params;
   
       const product = await productService.getById(parseInt(id));
   
       const response: ApiResponse = {
         success: true,
         data: product,
         timestamp: new Date().toISOString(),
       };
   
       res.status(200).json(response);
     }

}

export default new PublicProductController();