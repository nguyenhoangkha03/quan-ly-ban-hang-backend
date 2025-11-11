import { Router } from 'express';
import debtReconciliationController from '@controllers/debt-reconciliation.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createReconciliationSchema,
  confirmReconciliationSchema,
  reconciliationQuerySchema,
  sendReconciliationEmailSchema,
} from '@validators/debt-reconciliation.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/debt-reconciliation/summary - Get summary (must be before /:id)
router.get(
  '/summary',
  authorize('view_debt_reconciliation'),
  asyncHandler(debtReconciliationController.getSummary.bind(debtReconciliationController))
);

// GET /api/debt-reconciliation/customer/:customerId - Get by customer (must be before /:id)
router.get(
  '/customer/:customerId',
  authorize('view_debt_reconciliation'),
  asyncHandler(debtReconciliationController.getByCustomer.bind(debtReconciliationController))
);

// GET /api/debt-reconciliation/supplier/:supplierId - Get by supplier (must be before /:id)
router.get(
  '/supplier/:supplierId',
  authorize('view_debt_reconciliation'),
  asyncHandler(debtReconciliationController.getBySupplier.bind(debtReconciliationController))
);

// POST /api/debt-reconciliation/monthly - Create monthly reconciliation
router.post(
  '/monthly',
  authorize('create_debt_reconciliation'),
  validate(createReconciliationSchema),
  asyncHandler(debtReconciliationController.createMonthly.bind(debtReconciliationController))
);

// POST /api/debt-reconciliation/quarterly - Create quarterly reconciliation
router.post(
  '/quarterly',
  authorize('create_debt_reconciliation'),
  validate(createReconciliationSchema),
  asyncHandler(debtReconciliationController.createQuarterly.bind(debtReconciliationController))
);

// POST /api/debt-reconciliation/yearly - Create yearly reconciliation
router.post(
  '/yearly',
  authorize('create_debt_reconciliation'),
  validate(createReconciliationSchema),
  asyncHandler(debtReconciliationController.createYearly.bind(debtReconciliationController))
);

// GET /api/debt-reconciliation - Get all reconciliations
router.get(
  '/',
  authorize('view_debt_reconciliation'),
  validate(reconciliationQuerySchema),
  asyncHandler(debtReconciliationController.getAll.bind(debtReconciliationController))
);

// GET /api/debt-reconciliation/:id - Get reconciliation by ID
router.get(
  '/:id',
  authorize('view_debt_reconciliation'),
  asyncHandler(debtReconciliationController.getById.bind(debtReconciliationController))
);

// PUT /api/debt-reconciliation/:id/confirm - Confirm reconciliation
router.put(
  '/:id/confirm',
  authorize('confirm_debt_reconciliation'),
  validate(confirmReconciliationSchema),
  asyncHandler(debtReconciliationController.confirm.bind(debtReconciliationController))
);

// PUT /api/debt-reconciliation/:id/dispute - Dispute reconciliation
router.put(
  '/:id/dispute',
  authorize('confirm_debt_reconciliation'),
  asyncHandler(debtReconciliationController.dispute.bind(debtReconciliationController))
);

// POST /api/debt-reconciliation/:id/send-email - Send reconciliation email
router.post(
  '/:id/send-email',
  authorize('send_debt_reconciliation_email'),
  validate(sendReconciliationEmailSchema),
  asyncHandler(debtReconciliationController.sendEmail.bind(debtReconciliationController))
);

// GET /api/debt-reconciliation/:id/pdf - Export to PDF
router.get(
  '/:id/pdf',
  authorize('view_debt_reconciliation'),
  asyncHandler(debtReconciliationController.exportPdf.bind(debtReconciliationController))
);

export default router;
