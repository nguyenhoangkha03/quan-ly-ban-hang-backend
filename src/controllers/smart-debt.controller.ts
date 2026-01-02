import { Request, Response, NextFunction } from 'express';
import debtService from '../services/smart-debt.service'; 
import { ValidationError } from '../utils/errors'; 

// Interface cho Request có User (tùy chỉnh theo dự án của bạn)
export interface AuthRequest extends Request {
  user?: {
    id: number;
    roleId: number;
  };
}

class SmartDebtController {
  
  // =========================================================================
  // 1. NHÓM READ (Lấy dữ liệu)
  // =========================================================================

  // GET /api/smart-debt
  // Lấy danh sách, hỗ trợ lọc và phân trang
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      // Truyền toàn bộ query params xuống service để xử lý
      const result = await debtService.getAll(req.query);
      
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/smart-debt/:id
  // Lấy chi tiết một biên bản đối chiếu
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await debtService.getById(Number(id));
      
      res.status(200).json({
        success: true,
        data: data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 2. NHÓM ACTION (Tác động dữ liệu - Logic Mới)
  // =========================================================================

  // POST /api/smart-debt/calculate
  // [QUAN TRỌNG] Hàm này thay thế cho create cũ.
  // Nhiệm vụ: Tạo mới hoặc Tính toán lại số liệu công nợ cho khách hàng/NCC trong năm chỉ định.
  // async createOrSync(req: AuthRequest, res: Response, next: NextFunction) {
  //   try {
  //     // const userId = req.user?.id;
      
  //     // Lấy dữ liệu từ Body
  //     const { customerId, supplierId, notes, period, assignedUserId } = req.body;
  //     console.log('Assigned User ID:', assignedUserId);

  //     if (!customerId && !supplierId) {
  //       throw new ValidationError('Vui lòng chọn Khách hàng hoặc Nhà cung cấp');
  //     }

  //     // Xử lý logic năm: Frontend gửi "2025" -> Backend lấy số 2025
  //     // Nếu không gửi period, mặc định lấy năm hiện tại
  //     let year = new Date().getFullYear();
  //     if (period) {
  //         // Nếu period dạng "2025", "202512" -> Cố gắng lấy 4 ký tự đầu làm năm
  //         const yearString = String(period).substring(0, 4);
  //         if (!isNaN(Number(yearString))) {
  //             year = Number(yearString);
  //         }
  //     }

  //     // Gọi Service logic mới
  //     const data = await debtService.syncDebt({
  //       customerId: customerId ? Number(customerId) : undefined,
  //       supplierId: supplierId ? Number(supplierId) : undefined,
  //       notes: notes,
  //       year: year,
  //       assignedUserId: assignedUserId ? Number(assignedUserId) : undefined
  //     },);

  //     res.status(200).json({
  //       success: true,
  //       message: `Đã cập nhật số liệu công nợ năm ${year}`,
  //       data: data,
  //       timestamp: new Date().toISOString(),
  //     });
  //   } catch (error) {
  //     next(error);
  //   }
  // }

  async createOrSync(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // 1. LẤY NGƯỜI TẠO (Created By)
      // Nếu DB yêu cầu created_by, bạn BẮT BUỘC phải có dòng này.
      // Nếu req.user chưa có, hãy kiểm tra lại Middleware Auth.
      const currentUserId = req.user?.id; 

      if (!currentUserId) {
          // Tùy logic, nếu bắt buộc phải đăng nhập mới tạo được:
          // throw new UnauthorizedError("Không tìm thấy thông tin người dùng");
          console.warn("⚠️ Warning: Creating debt without logged-in user ID");
      }

      // 2. Lấy dữ liệu từ Body
      const { customerId, supplierId, notes, period, assignedUserId } = req.body;
      
      console.log('📦 Body received:', req.body);
      console.log('👤 Assigned User ID (Raw):', assignedUserId);

      if (!customerId && !supplierId) {
        throw new ValidationError('Vui lòng chọn Khách hàng hoặc Nhà cung cấp');
      }

      // 3. Xử lý Year
      let year = new Date().getFullYear();
      if (period) {
          const yearString = String(period).substring(0, 4);
          if (!isNaN(Number(yearString))) {
              year = Number(yearString);
          }
      }

      // 4. Xử lý Assigned User ID an toàn
      // Chuyển về Number nếu nó là string, bỏ qua nếu là null/undefined/0
      const parsedAssignedUserId = assignedUserId ? Number(assignedUserId) : undefined;

      // Gọi Service
      const data = await debtService.syncDebt({
        customerId: customerId ? Number(customerId) : undefined,
        supplierId: supplierId ? Number(supplierId) : undefined,
        notes: notes,
        year: year,
        assignedUserId: parsedAssignedUserId, // Người được giao việc
        // createdBy: currentUserId // <--- BỔ SUNG NẾU SERVICE CẦN
      });

      res.status(200).json({
        success: true,
        message: `Đã cập nhật số liệu công nợ năm ${year}`,
        data: data,
      });
    } catch (error) {
      next(error);
    }
}

  // =========================================================================
  // 3. TÍNH NĂNG MỞ RỘNG (Utility)
  // =========================================================================

  // GET /api/smart-debt/check-integrity
  // Kiểm tra sai lệch dữ liệu giữa các năm (Dành cho Admin/Kế toán)
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

  // POST /api/smart-debt/:id/email
  // Gửi email (Giữ lại nếu bạn vẫn muốn dùng tính năng này)
  async sendEmail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        
        // Lưu ý: Cần đảm bảo Service có hàm sendEmail (nếu bạn chưa xóa nó ở bước trước)
        // Nếu đã xóa, bạn cần thêm lại vào Service hoặc comment đoạn này
        if (typeof debtService.sendEmail === 'function') {
            const result = await debtService.sendEmail(Number(id), req.body, userId);
            res.status(200).json({
                success: true,
                message: result.message,
                data: result,
            });
        } else {
            res.status(501).json({ message: "Tính năng gửi email chưa được kích hoạt trong Service mới" });
        }
    } catch (error) {
        next(error);
    }
  }

  // GET /api/smart-debt/:id/pdf
  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const data = await debtService.getById(Number(id));
        
        res.status(200).json({
            success: true,
            data: data,
            message: 'Ready for frontend printing',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        next(error);
    }
  }
}

export default new SmartDebtController();