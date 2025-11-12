import { Request, Response } from 'express';
import cashFundService from '../services/cash-fund.service';

export class CashFundController {
  async getDailyCashFund(req: Request, res: Response) {
    try {
      const { date } = req.params;
      const fundDate = date ? new Date(date) : new Date();
      fundDate.setHours(0, 0, 0, 0);

      const fund = await cashFundService.getDailyCashFund(fundDate);

      res.json({
        success: true,
        data: fund,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getCashFundList(req: Request, res: Response) {
    try {
      const { startDate, endDate, isLocked } = req.query;

      const filter: any = {};

      if (startDate) {
        filter.startDate = new Date(startDate as string);
        filter.startDate.setHours(0, 0, 0, 0);
      }

      if (endDate) {
        filter.endDate = new Date(endDate as string);
        filter.endDate.setHours(23, 59, 59, 999);
      }

      if (isLocked !== undefined) {
        filter.isLocked = isLocked === 'true';
      }

      const funds = await cashFundService.getCashFundList(filter);

      res.json({
        success: true,
        data: funds,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createCashFund(req: Request, res: Response) {
    try {
      const { fundDate, openingBalance, notes } = req.body;

      const date = new Date(fundDate);
      date.setHours(0, 0, 0, 0);

      const fund = await cashFundService.createCashFund({
        fundDate: date,
        openingBalance,
        notes,
      });

      res.status(201).json({
        success: true,
        data: fund,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateCashFund(req: Request, res: Response) {
    try {
      const { date } = req.params;
      const { openingBalance, notes } = req.body;

      const fundDate = new Date(date);
      fundDate.setHours(0, 0, 0, 0);

      const fund = await cashFundService.updateCashFund(fundDate, {
        openingBalance,
        notes,
      });

      res.json({
        success: true,
        data: fund,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async lockCashFund(req: Request, res: Response) {
    try {
      const { date } = req.params;
      const { approvedBy, reconciledBy, notes } = req.body;
      const userId = (req as any).user?.userId;

      const fundDate = new Date(date);
      fundDate.setHours(0, 0, 0, 0);

      const fund = await cashFundService.lockCashFund(fundDate, {
        approvedBy: approvedBy || userId,
        reconciledBy: reconciledBy || userId,
        notes,
      });

      res.json({
        success: true,
        data: fund,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async unlockCashFund(req: Request, res: Response) {
    try {
      const { date } = req.params;

      const fundDate = new Date(date);
      fundDate.setHours(0, 0, 0, 0);

      const fund = await cashFundService.unlockCashFund(fundDate);

      res.json({
        success: true,
        data: fund,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getCashFundSummary(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);

      const summary = await cashFundService.getCashFundSummary(start, end);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getDiscrepancies(req: Request, res: Response) {
    try {
      const { date } = req.params;

      const fundDate = new Date(date);
      fundDate.setHours(0, 0, 0, 0);

      const discrepancies = await cashFundService.getDiscrepancies(fundDate);

      res.json({
        success: true,
        data: discrepancies,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new CashFundController();
