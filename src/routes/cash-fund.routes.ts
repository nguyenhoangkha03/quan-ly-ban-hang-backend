import { Router } from 'express';
import cashFundController from '../controllers/cash-fund.controller';
import { authentication } from '@middlewares/auth';
import { validate, validateMultiple } from '@middlewares/validate';
import {
  getCashFundListSchema,
  getDailyCashFundSchema,
  createCashFundSchema,
  updateCashFundSchema,
  lockCashFundSchema,
  unlockCashFundSchema,
  getCashFundSummarySchema,
  getDiscrepanciesSchema,
} from '../validators/cash-fund.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/cash-fund - Get list of cash funds
router.get('/', validateMultiple({
  query: getCashFundListSchema.shape.query,
}), cashFundController.getCashFundList);

// GET /api/cash-fund/summary - Get cash fund summary
router.get('/summary', validateMultiple({
  query: getCashFundSummarySchema.shape.query,
}), cashFundController.getCashFundSummary);

// GET /api/cash-fund/:date - Get daily cash fund
router.get('/:date', validateMultiple({
  params: getDailyCashFundSchema.shape.params,
}), cashFundController.getDailyCashFund);

// GET /api/cash-fund/:date/discrepancies - Get discrepancies for a date
router.get('/:date/discrepancies', validateMultiple({
  params: getDiscrepanciesSchema.shape.params,
}), cashFundController.getDiscrepancies);

// POST /api/cash-fund - Create cash fund
router.post('/', validate(createCashFundSchema, 'body'), cashFundController.createCashFund);

// PUT /api/cash-fund/:date - Update cash fund
router.put('/:date', validateMultiple({
  params: updateCashFundSchema.shape.params,
  body: updateCashFundSchema.shape.body,
}), cashFundController.updateCashFund);

// PUT /api/cash-fund/:date/lock - Lock cash fund
router.put('/:date/lock', validateMultiple({
  params: lockCashFundSchema.shape.params,
  body: lockCashFundSchema.shape.body,
}), cashFundController.lockCashFund);

// PUT /api/cash-fund/:date/unlock - Unlock cash fund
router.put('/:date/unlock', validateMultiple({
  params: unlockCashFundSchema.shape.params,
}), cashFundController.unlockCashFund);

export default router;
