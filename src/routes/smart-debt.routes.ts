import { Router } from 'express';
import smartDebtController from '@controllers/smart-debt.controller'; 
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validateNested } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  sendReconciliationEmailSchema,
} from '@validators/debt-reconciliation.validator';

const router = Router();

router.use(authentication);

// =============================================================================
// 1. NHÓM READ & UTILITY
// =============================================================================

// 1. Check Integrity (Cụ thể nhất -> Đặt đầu)
router.get(
  '/check-integrity',
  authorize('view_debt_reconciliation'),
  asyncHandler(smartDebtController.checkIntegrity.bind(smartDebtController))
);

// 2. Export PDF (Cụ thể -> Đặt TRƯỚC /:id) [cite: 308]
// Nếu để sau /:id, Express có thể hiểu "pdf" là một ID
router.get(
  '/:id/pdf',
  authorize('view_debt_reconciliation'),
  asyncHandler(smartDebtController.exportPdf.bind(smartDebtController))
);

// 3. Get Detail (Tham số động -> Đặt SAU các route cụ thể)
router.get(
  '/:id',
  authorize('view_debt_reconciliation'),
  asyncHandler(smartDebtController.getById.bind(smartDebtController))
);

// 4. Get List (Root)
router.get(
  '/',
  authorize('view_debt_reconciliation'),
  asyncHandler(smartDebtController.getAll.bind(smartDebtController))
);

// =============================================================================
// 2. NHÓM SYNC ACTIONS
// =============================================================================

router.post(
  '/sync-snap',
  authorize('create_debt_reconciliation'),
  asyncHandler(smartDebtController.syncSnap.bind(smartDebtController))
);

router.post(
  '/sync-full',
  authorize('create_debt_reconciliation'),
  asyncHandler(smartDebtController.syncFull.bind(smartDebtController))
);

router.post(
  '/sync-snap-batch',
  authorize('create_debt_reconciliation'),
  asyncHandler(smartDebtController.syncSnapBatch.bind(smartDebtController))
);

router.post(
  '/sync-full-batch',
  authorize('create_debt_reconciliation'),
  asyncHandler(smartDebtController.syncFullBatch.bind(smartDebtController))
);

// =============================================================================
// 3. NHÓM EMAIL
// =============================================================================

router.post(
  '/:id/email',
  authorize('send_debt_reconciliation_email'),
  validateNested(sendReconciliationEmailSchema),
  asyncHandler(smartDebtController.sendEmail.bind(smartDebtController))
);

export default router;