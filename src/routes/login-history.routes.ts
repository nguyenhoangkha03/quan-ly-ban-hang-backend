import { Router } from 'express';
import loginHistoryController from '@controllers/login-history.controller';
import { authentication } from '@middlewares/auth';
import { asyncHandler } from '@middlewares/errorHandler';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/settings/login-history - Get current user's login history
router.get('/', asyncHandler(loginHistoryController.getLoginHistory.bind(loginHistoryController)));

// POST /api/settings/login-history - Create login history entry (called by auth middleware)
router.post(
  '/',
  asyncHandler(loginHistoryController.createLoginHistory.bind(loginHistoryController))
);

// POST /api/settings/login-history/revoke - Revoke login sessions
router.post(
  '/revoke',
  asyncHandler(loginHistoryController.revokeLoginSessions.bind(loginHistoryController))
);

// GET /api/settings/login-history/stats - Get login statistics
router.get(
  '/stats',
  asyncHandler(loginHistoryController.getLoginStats.bind(loginHistoryController))
);

export default router;
