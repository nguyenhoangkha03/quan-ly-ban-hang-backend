import { Router } from 'express';
import productionReportController from '@controllers/production-report.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { asyncHandler } from '@middlewares/errorHandler';

const router = Router();

// All routes require authentication & view_reports permission
router.use(authentication);
router.use(authorize('view_reports'));

// =====================================================
// PRODUCTION REPORT ENDPOINTS
// =====================================================

// GET /api/reports/production/summary - KPI Cards Data
router.get(
  '/production/summary',
  asyncHandler(productionReportController.getSummary.bind(productionReportController))
);

// GET /api/reports/production/charts/timeline - Plan vs Actual Chart
router.get(
  '/production/charts/timeline',
  asyncHandler(productionReportController.getTimelineChart.bind(productionReportController))
);

// GET /api/reports/production/charts/top-wastage - Top 5 Wastage Materials Chart
router.get(
  '/production/charts/top-wastage',
  asyncHandler(productionReportController.getTopWastageChart.bind(productionReportController))
);

// GET /api/reports/production/charts/cost-structure - Cost Structure Chart
router.get(
  '/production/charts/cost-structure',
  asyncHandler(productionReportController.getCostStructureChart.bind(productionReportController))
);

// GET /api/reports/production/orders - Production Orders List (Tab 1)
router.get(
  '/production/orders',
  asyncHandler(productionReportController.getProductionOrders.bind(productionReportController))
);

// GET /api/reports/production/material-usage - Material Usage Report (Tab 2)
router.get(
  '/production/material-usage',
  asyncHandler(productionReportController.getMaterialUsageReport.bind(productionReportController))
);

export default router;
