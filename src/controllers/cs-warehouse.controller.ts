import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/common.type';
// Đảm bảo import đúng service bạn vừa tạo ở bước trước
import publicWarehouseService from '@services/cs-warehouse.service'; 

class PublicWarehouseController {
  
  /**
   * GET /api/public/warehouses
   * Lấy danh sách cửa hàng/kho hàng (Store Locator)
   * Hỗ trợ lọc theo: search, city, region, warehouseType
   */
  async getAllWarehouses(req: AuthRequest, res: Response) {
    // Truyền toàn bộ query params vào service xử lý
    const result = await publicWarehouseService.getAllWarehouses(req.query as any);

    const response: ApiResponse = {
      success: true,
      message: result.message,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // ĐÃ LOẠI BỎ:
  // - getWarehouseById (Khách không cần xem chi tiết sâu)
  // - getWarehouseStatistics (Khách không cần xem thống kê nhập xuất)
  // - getWarehouseCards (Khách không cần xem tổng quan dashboard)
}

export default new PublicWarehouseController();