import { Router } from 'express';
import stockTransactionController from '@controllers/stock-transaction.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate, validateMultiple } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createImportSchema,
  createExportSchema,
  createTransferSchema,
  createDisposalSchema,
  createStocktakeSchema,
  transactionQuerySchema,
  transactionIdSchema,
  approveTransactionSchema,
  cancelTransactionSchema,
} from '@validators/stock-transaction.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// POST /api/stock-transactions/import - Create import transaction
router.post(
  '/import',
  authorize('create_stock_transactions', 'manage_inventory'),
  validate(createImportSchema, 'body'),
  asyncHandler(stockTransactionController.createImport.bind(stockTransactionController))
);

// POST /api/stock-transactions/export - Create export transaction
router.post(
  '/export',
  authorize('create_stock_transactions', 'manage_inventory'),
  validate(createExportSchema, 'body'),
  asyncHandler(stockTransactionController.createExport.bind(stockTransactionController))
);

// POST /api/stock-transactions/transfer - Create transfer transaction
router.post(
  '/transfer',
  authorize('create_stock_transactions', 'manage_inventory'),
  validate(createTransferSchema, 'body'),
  asyncHandler(stockTransactionController.createTransfer.bind(stockTransactionController))
);

// POST /api/stock-transactions/disposal - Create disposal transaction
router.post(
  '/disposal',
  authorize('create_stock_transactions', 'manage_inventory'),
  validate(createDisposalSchema, 'body'),
  asyncHandler(stockTransactionController.createDisposal.bind(stockTransactionController))
);

// POST /api/stock-transactions/stocktake - Create stocktake transaction
router.post(
  '/stocktake',
  authorize('create_stock_transactions', 'manage_inventory'),
  validate(createStocktakeSchema, 'body'),
  asyncHandler(stockTransactionController.createStocktake.bind(stockTransactionController))
);

// PUT /api/stock-transactions/:id/approve - Approve transaction
router.put(
  '/:id/approve',
  authorize('approve_stock_transactions', 'manage_inventory'),
  validateMultiple({
    params: transactionIdSchema,
    body: approveTransactionSchema,
  }),
  asyncHandler(stockTransactionController.approve.bind(stockTransactionController))
);

// PUT /api/stock-transactions/:id/cancel - Cancel transaction
router.put(
  '/:id/cancel',
  authorize('cancel_stock_transactions', 'manage_inventory'),
  validateMultiple({
    params: transactionIdSchema,
    body: cancelTransactionSchema,
  }),
  asyncHandler(stockTransactionController.cancel.bind(stockTransactionController))
);

// GET /api/stock-transactions/:id - Get transaction by ID
router.get(
  '/:id',
  authorize('view_stock_transactions', 'view_inventory'),
  validate(transactionIdSchema, 'params'),
  asyncHandler(stockTransactionController.getById.bind(stockTransactionController))
);

// GET /api/stock-transactions - Get all transactions
router.get(
  '/',
  authorize('view_stock_transactions', 'view_inventory'),
  validate(transactionQuerySchema, 'query'),
  asyncHandler(stockTransactionController.getAll.bind(stockTransactionController))
);

export default router;
