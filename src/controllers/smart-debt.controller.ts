import { Request, Response, NextFunction } from 'express';
import debtService from '../services/smart-debt.service'; // Đảm bảo import đúng đường dẫn
import { ValidationError } from '../utils/errors'; // Hoặc class Error tùy chỉnh của bạn

// Interface cho Request có User (Middleware auth sẽ gắn vào)
export interface AuthRequest extends Request {
  user?: {
    id: number;
    roleId: number;
    // ... các field khác
  };
}

class SmartDebtController {

  // =========================================================================
  // 1. NHÓM READ (Lấy dữ liệu hiển thị)
  // =========================================================================

  // GET /api/smart-debt
  // Lấy danh sách công nợ (có phân trang, lọc theo năm/khách hàng)
  // GET /api/smart-debt
  // Lấy danh sách công nợ (Master View kèm thông tin kỳ mới nhất)
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      // Lấy thêm các tham số mới
      const { page, limit, search, status, year, assignedUserId, province, type } = req.query;

      const result = await debtService.getAll({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        search: search as string,
        status: status as any,
        year: year ? Number(year) : undefined,
        
        // ✅ Truyền tham số mới
        assignedUserId: assignedUserId ? Number(assignedUserId) : undefined,
        province: province as string,
        type: type as 'customer' | 'supplier'
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
        timestamp: new Date().toISOString(),
      });
      console.log('Fetched smart debt list successfully with data:', result.data);
    } catch (error) {
      next(error);
    }
  }

  // URL: /api/smart-debt/123?year=2025
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;  // Đây là MasterID (ID khách hàng trong bảng công nợ)
      const { year } = req.query; // Năm muốn xem chi tiết

      // Gọi hàm getDetail mới (thay vì getById cũ)
      const data = await debtService.getDetail(
          Number(id), 
          year ? Number(year) : undefined
      );
      
      res.status(200).json({
        success: true,
        data: data,
        timestamp: new Date().toISOString(),
      });

      console.log(`Fetched smart debt detail for ID ${id} successfully with data:`, data);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 2. NHÓM SYNC - SINGLE (Xử lý 1 khách hàng)
  // =========================================================================

  /**
   * POST /api/smart-debt/sync-snap
   * Chế độ: NHANH (Snapshot)
   * Dùng khi: Tạo đơn hàng, Thu tiền, bấm nút "Làm mới" trên UI
   */
  async syncSnap(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { customerId, supplierId, notes, year, assignedUserId } = req.body;
      const targetYear = year || new Date().getFullYear();

      // Validate cơ bản
      if (!customerId && !supplierId) {
        throw new ValidationError('Vui lòng chọn Khách hàng hoặc Nhà cung cấp');
      }

      // Gọi Service (Có await vì syncSnap chạy nhanh, user đợi được)
      const data = await debtService.syncSnap({
        customerId: customerId ? Number(customerId) : undefined,
        supplierId: supplierId ? Number(supplierId) : undefined,
        year: Number(targetYear),
        notes,
        assignedUserId: assignedUserId ? Number(assignedUserId) : undefined
      });

      res.status(200).json({
        success: true,
        message: `Đã cập nhật nhanh số liệu năm ${targetYear}`,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/smart-debt/sync-full
   * Chế độ: CHẬM (Full History)
   * Dùng khi: Sửa lỗi dữ liệu, khởi tạo dữ liệu cũ, nút "Đồng bộ sâu"
   */
  async syncFull(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { customerId, supplierId, notes, year, assignedUserId } = req.body;
      const targetYear = year || new Date().getFullYear();

      if (!customerId && !supplierId) {
        throw new ValidationError('Vui lòng chọn Khách hàng hoặc Nhà cung cấp');
      }

      // 🚀 FIRE & FORGET (Chạy nền để tránh timeout)
      debtService.syncFull({
        customerId: customerId ? Number(customerId) : undefined,
        supplierId: supplierId ? Number(supplierId) : undefined,
        year: Number(targetYear),
        notes,
        assignedUserId: assignedUserId ? Number(assignedUserId) : undefined
      })
      .then(() => console.log(`✅ [Background] SyncFull hoàn tất cho ID ${customerId || supplierId}`))
      .catch((err) => console.error(`❌ [Background] Lỗi SyncFull:`, err));

      // Trả về ngay lập tức
      res.status(202).json({
        success: true,
        message: "Hệ thống đang xử lý đồng bộ sâu trong nền. Vui lòng kiểm tra lại sau ít phút.",
        background: true
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 3. NHÓM SYNC - BATCH (Xử lý hàng loạt)
  // =========================================================================

  /**
   * POST /api/smart-debt/sync-snap-batch
   * Chế độ: NHANH TOÀN BỘ (Snapshot All)
   * Dùng khi: Chốt sổ cuối ngày, bấm nút "Làm mới tất cả"
   */
  async syncSnapBatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = req.body.year || new Date().getFullYear();

      // 🚀 FIRE & FORGET
      debtService.syncSnapAll(Number(year))
        .then((r) => console.log(`✅ [Batch Snap] Hoàn tất: ${r.success}/${r.totalChecked}`))
        .catch((e) => console.error(`❌ [Batch Snap] Lỗi:`, e));

      res.status(202).json({
        success: true,
        message: `Đã kích hoạt đồng bộ nhanh toàn hệ thống năm ${year}.`,
        background: true
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/smart-debt/sync-full-batch
   * Chế độ: CHẬM TOÀN BỘ (Full All - Maintenance)
   * Dùng khi: Bảo trì hệ thống định kỳ
   */
  async syncFullBatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = req.body.year || new Date().getFullYear();

      // 🚀 FIRE & FORGET
      debtService.syncFullAll(Number(year))
        .then((r) => console.log(`✅ [Batch Full] Hoàn tất: ${r.success}/${r.totalChecked}`))
        .catch((e) => console.error(`❌ [Batch Full] Lỗi:`, e));

      res.status(202).json({
        success: true,
        message: `Đã kích hoạt chế độ BẢO TRÌ hệ thống năm ${year}. Quá trình này có thể mất nhiều thời gian.`,
        background: true
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 4. TIỆN ÍCH KHÁC (Check Integrity, PDF...)
  // =========================================================================

  // GET /api/smart-debt/check-integrity
  // Kiểm tra sai lệch dữ liệu
  async checkIntegrity(req: Request, res: Response, next: NextFunction) {
    try {
        const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
        
        const result = await debtService.checkDataIntegrity(year);
        
        res.status(200).json({
            success: true,
            message: result.discrepanciesCount > 0 
                ? `Cảnh báo: Phát hiện ${result.discrepanciesCount} sai lệch dữ liệu!` 
                : 'Dữ liệu toàn vẹn, không có sai lệch.',
            data: result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        next(error);
    }
  }

  /**
   * POST /api/smart-debt/:id/email
   * Gửi biên bản đối chiếu qua email cho khách hàng/NCC.
   * Yêu cầu: Đăng nhập (để lấy userId ghi log).
   */
  async sendEmail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const emailData = req.body; // Dữ liệu: { recipientEmail, recipientName, message... }
      
      // Lấy ID nhân viên đang thực hiện thao tác (từ token)
      const userId = req.user?.id; 

      if (!userId) {
        // Trường hợp hiếm: Middleware auth lọt lưới hoặc user bị null
        res.status(401).json({ success: false, message: "Không xác định được người gửi." });
        return;
      }

      // Gọi Service xử lý logic gửi & ghi log
      const result = await debtService.sendEmail(Number(id), emailData, userId);

      res.status(200).json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/smart-debt/:id/pdf
  // Xuất dữ liệu để in ấn (Theo Master ID + Năm)
  // URL ví dụ: /api/smart-debt/10/pdf?year=2025
  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;  // Đây là Master ID
        const { year } = req.query; // Năm cần in

        // ✅ Gọi hàm getDetail mới (Thay vì getById cũ)
        // Hàm này đã trả về đủ thông tin: Khách, Hàng hóa, Thanh toán...
        const data = await debtService.getDetail(
            Number(id), 
            year ? Number(year) : undefined
        );
        
        // Nếu muốn Backend tự generate PDF file (Buffer/Stream) thì gọi service khác
        // Còn nếu Frontend tự render (như code cũ của bạn) thì chỉ cần trả data về
        res.status(200).json({
            success: true,
            data: data,
            message: 'Ready for frontend printing',
        });
    } catch (error) {
        next(error);
    }
  }

}

export default new SmartDebtController();