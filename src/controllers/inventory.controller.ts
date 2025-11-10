import { Response } from 'express';
import { AuthRequest } from '@custom-types/index';
import inventoryService from '@services/inventory.service';
import { ApiResponse } from '@custom-types/index';

class InventoryController {
  // GET /api/inventory - Get all inventory
  async getAll(req: AuthRequest, res: Response) {
    const {
      warehouseId,
      productId,
      productType,
      categoryId,
      lowStock,
      sortBy,
      sortOrder,
    } = req.query as any;

    const inventory = await inventoryService.getAll({
      warehouseId: warehouseId ? parseInt(warehouseId) : undefined,
      productId: productId ? parseInt(productId) : undefined,
      productType,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      lowStock: lowStock === 'true',
      sortBy,
      sortOrder,
    });

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
    const { warehouseId } = req.query;

    const alerts = await inventoryService.getAlerts(
      warehouseId ? parseInt(warehouseId as string) : undefined
    );

    const response: ApiResponse = {
      success: true,
      data: alerts,
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
}

export default new InventoryController();
