import { Router } from 'express';
import reportController from '@controllers/report.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  revenueReportSchema,
  inventoryReportSchema,
  dateRangeSchema,
  topProductsSchema,
  topCustomersSchema,
} from '@validators/report.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// =====================================================
// DASHBOARD
// =====================================================
// GET /api/reports/dashboard - Dashboard overview
router.get(
  '/dashboard',
  authorize('view_reports'),
  asyncHandler(reportController.getDashboard.bind(reportController))
);

// GET /api/reports/dashboard/metrics - Dashboard metrics only
router.get(
  '/dashboard/metrics',
  authorize('view_reports'),
  asyncHandler(reportController.getDashboardMetrics.bind(reportController))
);

// GET /api/reports/dashboard/revenue - Dashboard revenue with period filter
router.get(
  '/dashboard/revenue',
  authorize('view_reports'),
  asyncHandler(reportController.getDashboardRevenue.bind(reportController))
);

// GET /api/reports/dashboard/sales-channels - Revenue by sales channel
router.get(
  '/dashboard/sales-channels',
  authorize('view_reports'),
  asyncHandler(reportController.getDashboardSalesChannels.bind(reportController))
);

// GET /api/reports/dashboard/inventory-by-type - Inventory grouped by type
router.get(
  '/dashboard/inventory-by-type',
  authorize('view_reports'),
  asyncHandler(reportController.getDashboardInventoryByType.bind(reportController))
);

// GET /api/reports/dashboard/recent-orders - Recent orders
router.get(
  '/dashboard/recent-orders',
  authorize('view_reports'),
  asyncHandler(reportController.getDashboardRecentOrders.bind(reportController))
);

// GET /api/reports/dashboard/top-products - Top selling products
router.get(
  '/dashboard/top-products',
  authorize('view_reports'),
  asyncHandler(reportController.getDashboardTopProducts.bind(reportController))
);

// =====================================================
// REVENUE REPORTS
// =====================================================
// GET /api/reports/revenue - Revenue report with grouping
router.get(
  '/revenue',
  authorize('view_reports'),
  validate(revenueReportSchema),
  asyncHandler(reportController.getRevenueReport.bind(reportController))
);

// GET /api/reports/revenue/by-channel - Revenue by sales channel
router.get(
  '/revenue/by-channel',
  authorize('view_reports'),
  validate(dateRangeSchema),
  asyncHandler(reportController.getRevenueByChannel.bind(reportController))
);

// GET /api/reports/revenue/by-region - Revenue by region
router.get(
  '/revenue/by-region',
  authorize('view_reports'),
  validate(dateRangeSchema),
  asyncHandler(reportController.getRevenueByRegion.bind(reportController))
);

// =====================================================
// INVENTORY REPORTS
// =====================================================
// GET /api/reports/inventory - Inventory report
router.get(
  '/inventory',
  authorize('view_reports'),
  validate(inventoryReportSchema),
  asyncHandler(reportController.getInventoryReport.bind(reportController))
);

// GET /api/reports/inventory/by-type - Inventory by product type
router.get(
  '/inventory/by-type',
  authorize('view_reports'),
  asyncHandler(reportController.getInventoryByType.bind(reportController))
);

// GET /api/reports/inventory/turnover - Inventory turnover rate
router.get(
  '/inventory/turnover',
  authorize('view_reports'),
  validate(dateRangeSchema),
  asyncHandler(reportController.getInventoryTurnover.bind(reportController))
);

// =====================================================
// SALES REPORTS
// =====================================================
// GET /api/reports/sales/top-products - Top selling products
router.get(
  '/sales/top-products',
  authorize('view_reports'),
  validate(topProductsSchema),
  asyncHandler(reportController.getTopSellingProducts.bind(reportController))
);

// GET /api/reports/sales/top-customers - Top customers
router.get(
  '/sales/top-customers',
  authorize('view_reports'),
  validate(topCustomersSchema),
  asyncHandler(reportController.getTopCustomers.bind(reportController))
);

// =====================================================
// PRODUCTION REPORTS
// =====================================================
// GET /api/reports/production - Production report
router.get(
  '/production',
  authorize('view_reports'),
  validate(dateRangeSchema),
  asyncHandler(reportController.getProductionReport.bind(reportController))
);

// GET /api/reports/production/wastage - Wastage report
router.get(
  '/production/wastage',
  authorize('view_reports'),
  validate(dateRangeSchema),
  asyncHandler(reportController.getWastageReport.bind(reportController))
);

// =====================================================
// EMPLOYEE REPORTS
// =====================================================
// GET /api/reports/employee-performance - Employee performance
router.get(
  '/employee-performance',
  authorize('view_reports'),
  validate(dateRangeSchema),
  asyncHandler(reportController.getEmployeePerformance.bind(reportController))
);

// =====================================================
// FINANCIAL REPORTS
// =====================================================
// GET /api/reports/financial - Financial summary
router.get(
  '/financial',
  authorize('view_reports'),
  validate(dateRangeSchema),
  asyncHandler(reportController.getFinancialSummary.bind(reportController))
);

export default router;
