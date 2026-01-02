import { Router } from 'express';
import smartDebtController from '@controllers/smart-debt.controller'; 
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validateNested } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  // reconciliationQuerySchema, 
  sendReconciliationEmailSchema,
  // Các schema cũ như confirm/dispute có thể bỏ nếu không dùng nữa
} from '@validators/debt-reconciliation.validator';

const router = Router();

// =============================================================================
// MIDDLEWARES
// =============================================================================
router.use(authentication);

// =============================================================================
// 1. NHÓM READ (Lấy dữ liệu)
// =============================================================================

// GET /api/smart-debt/check-integrity
// [MỚI] Kiểm tra sai lệch dữ liệu giữa các năm (Dành cho Admin/Kế toán)
// Route này phải đặt TRƯỚC route /:id để tránh bị nhầm 'check-integrity' là một ID
router.get(
  '/check-integrity',
  authorize('view_debt_reconciliation'),
  asyncHandler(smartDebtController.checkIntegrity.bind(smartDebtController))
);

// GET /api/smart-debt
// Lấy danh sách + Lọc đa năng
router.get(
  '/',
  authorize('view_debt_reconciliation'),
  // validateNested(reconciliationQuerySchema), // Bật lại nếu bạn muốn validate query params chặt chẽ
  asyncHandler(smartDebtController.getAll.bind(smartDebtController))
);

// GET /api/smart-debt/:id
// Xem chi tiết 1 kỳ đối chiếu
router.get(
  '/:id',
  authorize('view_debt_reconciliation'),
  asyncHandler(smartDebtController.getById.bind(smartDebtController))
);

// =============================================================================
// 2. NHÓM ACTION (Tác động dữ liệu)
// =============================================================================

// POST /api/smart-debt/calculate
// [CORE] Tạo mới hoặc Tính toán lại số liệu (Sync)
// Gọi hàm này khi: Bấm nút "Tạo/Cập nhật" trên FE hoặc Trigger từ đơn hàng
router.post(
  '/calculate',
  authorize('create_debt_reconciliation'),
  asyncHandler(smartDebtController.createOrSync.bind(smartDebtController))
);

// POST /api/smart-debt/:id/email
// Gửi email thông báo công nợ cho khách
router.post(
  '/:id/email',
  authorize('send_debt_reconciliation_email'),
  validateNested(sendReconciliationEmailSchema),
  asyncHandler(smartDebtController.sendEmail.bind(smartDebtController))
);

// GET /api/smart-debt/:id/pdf
// Lấy dữ liệu để in PDF
router.get(
  '/:id/pdf',
  authorize('view_debt_reconciliation'),
  asyncHandler(smartDebtController.exportPdf.bind(smartDebtController))
);

export default router;