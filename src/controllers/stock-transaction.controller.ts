import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import stockTransactionService from '@services/stock-transaction.service';
import { ApiResponse } from '@custom-types/common.type';

class StockTransactionController {
  // GET /api/stock-transactions
  async getAll(req: AuthRequest, res: Response) {
    const {
      page,
      limit,
      transactionType,
      warehouseId,
      status,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    } = req.query as any;

    const result = await stockTransactionService.getAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      transactionType,
      warehouseId: warehouseId ? parseInt(warehouseId) : undefined,
      status,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    });

    const response: ApiResponse = {
      success: true,
      data: result.transactions,
      meta: result.pagination,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/stock-transactions/:id
  async getById(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const transaction = await stockTransactionService.getById(parseInt(id));

    const response: ApiResponse = {
      success: true,
      data: transaction,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/stock-transactions/import
  async createImport(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const data = req.body;

    const transaction = await stockTransactionService.createImport(data, userId);

    const response: ApiResponse = {
      success: true,
      data: transaction,
      message: 'Import transaction created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // POST /api/stock-transactions/export
  async createExport(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const data = req.body;

    const transaction = await stockTransactionService.createExport(data, userId);

    const response: ApiResponse = {
      success: true,
      data: transaction,
      message: 'Export transaction created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // POST /api/stock-transactions/transfer
  async createTransfer(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const data = req.body;

    const transaction = await stockTransactionService.createTransfer(data, userId);

    const response: ApiResponse = {
      success: true,
      data: transaction,
      message: 'Transfer transaction created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // POST /api/stock-transactions/disposal
  async createDisposal(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const data = req.body;

    const transaction = await stockTransactionService.createDisposal(data, userId);

    const response: ApiResponse = {
      success: true,
      data: transaction,
      message: 'Disposal transaction created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // POST /api/stock-transactions/stocktake
  async createStocktake(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const data = req.body;

    const transaction = await stockTransactionService.createStocktake(data, userId);

    const response: ApiResponse = {
      success: true,
      data: transaction,
      message: 'Stocktake transaction created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/stock-transactions/:id/approve
  async approve(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const { notes } = req.body;

    const transaction = await stockTransactionService.approve(parseInt(id), userId, notes);

    const response: ApiResponse = {
      success: true,
      data: transaction,
      message: 'Transaction approved and inventory updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // PUT /api/stock-transactions/:id/cancel
  async cancel(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const { reason } = req.body;

    const transaction = await stockTransactionService.cancel(parseInt(id), userId, reason);

    const response: ApiResponse = {
      success: true,
      data: transaction,
      message: 'Transaction cancelled successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new StockTransactionController();
