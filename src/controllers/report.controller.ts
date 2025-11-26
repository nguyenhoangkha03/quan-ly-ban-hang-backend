import { Response } from 'express';
import { AuthRequest } from '@custom-types/index';
import reportService from '@services/report.service';

class ReportController {
  // GET /api/reports/dashboard - Dashboard overview
  async getDashboard(_req: AuthRequest, res: Response) {
    const dashboard = await reportService.getDashboard();

    res.status(200).json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/dashboard/metrics - Dashboard metrics only
  async getDashboardMetrics(_req: AuthRequest, res: Response) {
    const metrics = await reportService.getDashboardMetrics();

    res.status(200).json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/dashboard/revenue?period=month - Dashboard revenue
  async getDashboardRevenue(req: AuthRequest, res: Response) {
    const { period = 'month' } = req.query;
    const revenue = await reportService.getDashboardRevenue(period as string);

    res.status(200).json({
      success: true,
      data: revenue,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/dashboard/sales-channels - Revenue by sales channel
  async getDashboardSalesChannels(_req: AuthRequest, res: Response) {
    const salesChannels = await reportService.getDashboardSalesChannels();

    res.status(200).json({
      success: true,
      data: salesChannels,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/dashboard/inventory-by-type - Inventory grouped by type
  async getDashboardInventoryByType(_req: AuthRequest, res: Response) {
    const inventoryByType = await reportService.getDashboardInventoryByType();

    res.status(200).json({
      success: true,
      data: inventoryByType,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/dashboard/recent-orders?limit=10 - Recent orders
  async getDashboardRecentOrders(req: AuthRequest, res: Response) {
    const { limit = '10' } = req.query;
    const recentOrders = await reportService.getDashboardRecentOrders(parseInt(limit as string));

    res.status(200).json({
      success: true,
      data: recentOrders,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/dashboard/top-products?limit=10 - Top selling products
  async getDashboardTopProducts(req: AuthRequest, res: Response) {
    const { limit = '10' } = req.query;
    const topProducts = await reportService.getDashboardTopProducts(parseInt(limit as string));

    res.status(200).json({
      success: true,
      data: topProducts,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/revenue - Revenue report
  async getRevenueReport(req: AuthRequest, res: Response) {
    const result = await reportService.getRevenueReport(req.query as any);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/revenue/by-channel - Revenue by sales channel
  async getRevenueByChannel(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;
    const result = await reportService.getRevenueByChannel(
      fromDate as string,
      toDate as string
    );

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/revenue/by-region - Revenue by region
  async getRevenueByRegion(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;
    const result = await reportService.getRevenueByRegion(fromDate as string, toDate as string);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/inventory - Inventory report
  async getInventoryReport(req: AuthRequest, res: Response) {
    const result = await reportService.getInventoryReport(req.query as any);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/inventory/by-type - Inventory by product type
  async getInventoryByType(_req: AuthRequest, res: Response) {
    const result = await reportService.getInventoryByType();

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/inventory/turnover - Inventory turnover rate
  async getInventoryTurnover(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;
    const result = await reportService.getInventoryTurnover(
      fromDate as string,
      toDate as string
    );

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/sales/top-products - Top selling products
  async getTopSellingProducts(req: AuthRequest, res: Response) {
    const { limit, fromDate, toDate } = req.query;
    const result = await reportService.getTopSellingProducts(
      limit ? parseInt(limit as string) : 10,
      fromDate as string,
      toDate as string
    );

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/sales/top-customers - Top customers
  async getTopCustomers(req: AuthRequest, res: Response) {
    const { limit, fromDate, toDate } = req.query;
    const result = await reportService.getTopCustomers(
      limit ? parseInt(limit as string) : 10,
      fromDate as string,
      toDate as string
    );

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/production - Production report
  async getProductionReport(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;
    const result = await reportService.getProductionReport(
      fromDate as string,
      toDate as string
    );

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/production/wastage - Wastage report
  async getWastageReport(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;
    const result = await reportService.getWastageReport(fromDate as string, toDate as string);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/employee-performance - Employee performance
  async getEmployeePerformance(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;
    const result = await reportService.getEmployeePerformance(
      fromDate as string,
      toDate as string
    );

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/financial - Financial summary
  async getFinancialSummary(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;
    const result = await reportService.getFinancialSummary(
      fromDate as string,
      toDate as string
    );

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }
}

export default new ReportController();
