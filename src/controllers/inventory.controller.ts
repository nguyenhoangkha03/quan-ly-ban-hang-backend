import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import inventoryService from '@services/inventory.service';
import { ApiResponse } from '@custom-types/common.type';

class InventoryController {
  // GET /api/inventory - Get all inventory
  async getAll(req: AuthRequest, res: Response) {
    const result = await inventoryService.getAll(req.query as any);

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/inventory/warehouse/:warehouseId
  async getByWarehouse(req: AuthRequest, res: Response) {
    const { warehouseId } = req.params;

    const inventory = await inventoryService.getByWarehouse(parseInt(warehouseId));

    const response: ApiResponse = {
      success: true,
      data: inventory,
      meta: {
        total: inventory.length,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/inventory/product/:productId
  async getByProduct(req: AuthRequest, res: Response) {
    const { productId } = req.params;

    const inventory = await inventoryService.getByProduct(parseInt(productId));

    const response: ApiResponse = {
      success: true,
      data: inventory,
      message: 'Lấy tồn kho theo sản phẩm thành công',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/inventory/check - Check availability
  async checkAvailability(req: AuthRequest, res: Response) {
    const { items } = req.body;

    const result = await inventoryService.checkAvailability(items);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // PUT /api/inventory/update - Manual update (admin)
  async update(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const data = req.body;

    const inventory = await inventoryService.update(data, userId);

    const response: ApiResponse = {
      success: true,
      data: inventory,
      message: 'Inventory updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/inventory/adjust - Adjust inventory
  async adjust(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const data = req.body;

    const inventory = await inventoryService.adjust(data, userId);

    const response: ApiResponse = {
      success: true,
      data: inventory,
      message: 'Inventory adjusted successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/inventory/reserve - Reserve inventory
  async reserve(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { items, referenceType, referenceId } = req.body;

    const result = await inventoryService.reserve(items, referenceType, referenceId, userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/inventory/release-reserved - Release reserved inventory
  async releaseReserved(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { items, referenceType, referenceId } = req.body;

    const result = await inventoryService.releaseReserved(
      items,
      referenceType,
      referenceId,
      userId
    );

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/inventory/alerts - Get inventory alerts
  async getAlerts(req: AuthRequest, res: Response) {
    const result = await inventoryService.getAlerts(req.query as any);

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/inventory/value-report - Get inventory value report
  async getValueReport(req: AuthRequest, res: Response) {
    const { warehouseId } = req.query;

    const report = await inventoryService.getValueReport(
      warehouseId ? parseInt(warehouseId as string) : undefined
    );

    const response: ApiResponse = {
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/inventory/stats - Get inventory statistics (not affected by pagination)
  async getStats(req: AuthRequest, res: Response) {
    const { warehouseType } = req.query;

    const stats = await inventoryService.getStats({
      warehouseType: warehouseType as string | undefined,
    });

    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new InventoryController();
