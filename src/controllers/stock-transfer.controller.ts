import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import stockTransferService from '@services/stock-transfer.service';
import { ApiResponse } from '@custom-types/common.type';

class StockTransferController {
  // GET /api/stock-transfers
  async getAll(req: AuthRequest, res: Response) {
    const {
      page,
      limit,
      fromWarehouseId,
      toWarehouseId,
      status,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    } = req.query as any;

    const result = await stockTransferService.getAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      fromWarehouseId: fromWarehouseId ? parseInt(fromWarehouseId) : undefined,
      toWarehouseId: toWarehouseId ? parseInt(toWarehouseId) : undefined,
      status,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    });

    const response: ApiResponse = {
      success: true,
      data: result.transfers,
      meta: result.pagination,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/stock-transfers/:id
  async getById(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const transfer = await stockTransferService.getById(parseInt(id));

    const response: ApiResponse = {
      success: true,
      data: transfer,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/stock-transfers
  async create(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const data = req.body;

    const transfer = await stockTransferService.create(data, userId);

    const response: ApiResponse = {
      success: true,
      data: transfer,
      message: 'Stock transfer created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/stock-transfers/:id
  async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const data = req.body;

    const transfer = await stockTransferService.update(parseInt(id), data, userId);

    const response: ApiResponse = {
      success: true,
      data: transfer,
      message: 'Stock transfer updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // PUT /api/stock-transfers/:id/approve
  async approve(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    const transfer = await stockTransferService.approve(parseInt(id), userId);

    const response: ApiResponse = {
      success: true,
      data: transfer,
      message: 'Transfer approved and inventory reserved successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // PUT /api/stock-transfers/:id/complete
  async complete(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    const transfer = await stockTransferService.complete(parseInt(id), userId);

    const response: ApiResponse = {
      success: true,
      data: transfer,
      message: 'Transfer completed and inventory updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // PUT /api/stock-transfers/:id/cancel
  async cancel(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const { reason } = req.body;

    const transfer = await stockTransferService.cancel(parseInt(id), userId, reason);

    const response: ApiResponse = {
      success: true,
      data: transfer,
      message: 'Transfer cancelled successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // DELETE /api/stock-transfers/:id
  async delete(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await stockTransferService.delete(parseInt(id), userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new StockTransferController();
