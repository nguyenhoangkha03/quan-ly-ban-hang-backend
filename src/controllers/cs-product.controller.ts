import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import productService from '@services/cs-product.service'; 
import { ApiResponse } from '@custom-types/common.type';
import { ProductQueryInput } from '@validators/product.validator';

class PublicProductController {
    
    // GET /api/cs/categories - Lấy danh sách sản phẩm (có filter/search/pagination/sorting/status)
     async getAll(req: AuthRequest, res: Response) {
       // 1. Ép kiểu req.query về ProductQueryInput do zod
       const queryParams = req.query as unknown as ProductQueryInput;
   
       // 2. Gọi Service truyền thẳng object vào
       const result = await productService.getAll({
         ...queryParams, // Spread toàn bộ tham số (page, limit, search...)
         
         status: 'active', 
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