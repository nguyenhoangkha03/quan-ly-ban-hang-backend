import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import productionReportService from '@services/production-report.service';

class ProductionReportController {
  // GET /api/reports/production/summary
  async getSummary(req: AuthRequest, res: Response) {
    const { startDate, endDate, status, finishedProductId, createdBy } = req.query;

    const result = await productionReportService.getProductionSummary({
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      finishedProductId: finishedProductId ? parseInt(finishedProductId as string) : undefined,
      createdBy: createdBy ? parseInt(createdBy as string) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/production/charts/timeline
  async getTimelineChart(req: AuthRequest, res: Response) {
    const { startDate, endDate, status, finishedProductId, createdBy } = req.query;

    const result = await productionReportService.getTimelineChart({
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      finishedProductId: finishedProductId ? parseInt(finishedProductId as string) : undefined,
      createdBy: createdBy ? parseInt(createdBy as string) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/production/charts/top-wastage
  async getTopWastageChart(req: AuthRequest, res: Response) {
    const { startDate, endDate, status, finishedProductId, createdBy } = req.query;

    const result = await productionReportService.getTopWastageChart({
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      finishedProductId: finishedProductId ? parseInt(finishedProductId as string) : undefined,
      createdBy: createdBy ? parseInt(createdBy as string) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/production/charts/cost-structure
  async getCostStructureChart(req: AuthRequest, res: Response) {
    const { startDate, endDate, status, finishedProductId, createdBy } = req.query;

    const result = await productionReportService.getCostStructureChart({
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      finishedProductId: finishedProductId ? parseInt(finishedProductId as string) : undefined,
      createdBy: createdBy ? parseInt(createdBy as string) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/production/orders
  async getProductionOrders(req: AuthRequest, res: Response) {
    const { startDate, endDate, status, finishedProductId, createdBy, page, limit } = req.query;

    const result = await productionReportService.getProductionOrders({
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      finishedProductId: finishedProductId ? parseInt(finishedProductId as string) : undefined,
      createdBy: createdBy ? parseInt(createdBy as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/reports/production/material-usage
  async getMaterialUsageReport(req: AuthRequest, res: Response) {
    const { startDate, endDate, status, finishedProductId, createdBy } = req.query;

    const result = await productionReportService.getMaterialUsageReport({
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      finishedProductId: finishedProductId ? parseInt(finishedProductId as string) : undefined,
      createdBy: createdBy ? parseInt(createdBy as string) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }
}

export default new ProductionReportController();
