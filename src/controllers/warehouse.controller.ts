import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import warehouseService from '@services/warehouse.service';
import { ApiResponse } from '@custom-types/common.type';

class WarehouseController {
  // GET /api/warehouses
  async getAllWarehouses(req: AuthRequest, res: Response) {
    const result = await warehouseService.getAllWarehouses(req.query as any);

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/warehouses/:id
  async getWarehouseById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const warehouse = await warehouseService.getWarehouseById(id);

    const response: ApiResponse = {
      success: true,
      data: warehouse,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/warehouses
  async createWarehouse(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const warehouse = await warehouseService.createWarehouse(req.body, userId);

    const response: ApiResponse = {
      success: true,
      data: warehouse,
      message: 'Warehouse created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/warehouses/:id
  async updateWarehouse(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const warehouse = await warehouseService.updateWarehouse(id, req.body, userId);

    const response: ApiResponse = {
      success: true,
      data: warehouse,
      message: 'Warehouse updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // DELETE /api/warehouses/:id
  async deleteWarehouse(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await warehouseService.deleteWarehouse(id, userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/warehouses/:id/statistics
  async getWarehouseStatistics(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const stats = await warehouseService.getWarehouseStatistics(id);

    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new WarehouseController();
