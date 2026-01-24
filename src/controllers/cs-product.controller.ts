import { Response, Request } from 'express';
import storeProductService from '@services/cs-product.service';
import { ApiResponse } from '@custom-types/common.type';

// Nếu bạn có interface AuthRequest thì import vào, nếu không dùng (req as any) cũng được
// import { AuthRequest } from '@custom-types/common.type';

class PublicProductController {
    
    // =================================================================
    // GET /api/store/products (Danh sách - Có bộ lọc & Đa giá)
    // =================================================================
    async getAll(req: Request, res: Response) {

       const { 
           page, limit, search, categoryId, 
           isFeatured, sortBy,
           packagingType
       } = req.query;
   
       // 2. XÁC ĐỊNH LOẠI KHÁCH HÀNG (Quan trọng)
       // Giả sử middleware authentication (optional) đã gán user vào req
       // Nếu không có user (khách vãng lai) => Mặc định là 'retail'
       const currentUser = (req as any).user; 
       console.log('Current User classification:', currentUser?.classification);
       const userType = currentUser?.classification || 'retail';
       console.log('Determined userType:', userType);

       // 3. Gọi Service
       const result = await storeProductService.getPublicProducts({
         // Phân trang & Tìm kiếm
         page: page ? Number(page) : 1,
         limit: limit ? Number(limit) : 20,
         search: search as string,
         
         // Bộ lọc cơ bản
         categoryId: categoryId ? Number(categoryId) : undefined,
         isFeatured: isFeatured === 'true' ? true : undefined,
         sortBy: sortBy as any,

         packagingType: packagingType as any,
         userType: userType, 
       });

       const response: ApiResponse = {
         success: true,
         data: result.data, 
         meta: result.pagination,
         timestamp: new Date().toISOString(),
       };
   
       res.status(200).json(response);
     }
   
     // =================================================================
     // GET /api/store/products/:id (Chi tiết - Có đa giá & List khuyến mãi)
     // =================================================================
     async getById(req: Request, res: Response) {
       const { id } = req.params;
   
       // 1. Lấy User Type tương tự như trên
       const currentUser = (req as any).user;
       const userType = currentUser?.classification || 'retail';

       // 2. Gọi hàm detail kèm userType
       const product = await storeProductService.getProductDetail(Number(id), userType);
   
       const response: ApiResponse = {
         success: true,
         data: product,
         timestamp: new Date().toISOString(),
       };
   
       res.status(200).json(response);
     }

}

export default new PublicProductController();