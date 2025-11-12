import { Router } from 'express';
import cashFundController from '../controllers/cash-fund.controller';
import { authentication } from '@middlewares/auth';
import { validate } from '@middlewares/validate';
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
router.get('/', validate(getCashFundListSchema), cashFundController.getCashFundList);

// GET /api/cash-fund/summary - Get cash fund summary
router.get('/summary', validate(getCashFundSummarySchema), cashFundController.getCashFundSummary);

// GET /api/cash-fund/:date - Get daily cash fund
router.get('/:date', validate(getDailyCashFundSchema), cashFundController.getDailyCashFund);

// GET /api/cash-fund/:date/discrepancies - Get discrepancies for a date
router.get('/:date/discrepancies', validate(getDiscrepanciesSchema), cashFundController.getDiscrepancies);

// POST /api/cash-fund - Create cash fund
router.post('/', validate(createCashFundSchema), cashFundController.createCashFund);

// PUT /api/cash-fund/:date - Update cash fund
router.put('/:date', validate(updateCashFundSchema), cashFundController.updateCashFund);

// PUT /api/cash-fund/:date/lock - Lock cash fund
router.put('/:date/lock', validate(lockCashFundSchema), cashFundController.lockCashFund);

// PUT /api/cash-fund/:date/unlock - Unlock cash fund
router.put('/:date/unlock', validate(unlockCashFundSchema), cashFundController.unlockCashFund);

export default router;
