import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import productionOrderService from '@services/production-order.service';

class ProductionOrderController {
  // GET /api/production-orders - Get all production orders
  async getAll(req: AuthRequest, res: Response) {
    const result = await productionOrderService.getAll(req.query as any);

    res.status(200).json({
      success: true,
      data: result.data,
      message: result.message,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/production-orders/:id - Get production order by ID
  async getById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const order = await productionOrderService.getById(id);

    res.status(200).json({
      success: true,
      data: order,
      message: 'Lấy lệnh sản xuất thành công',
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/production-orders - Create new production order
  async create(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const productionOrder = await productionOrderService.create(req.body, userId);

    res.status(201).json({
      success: true,
      data: productionOrder,
      message: 'Lệnh sản xuất được tạo thành công',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/production-orders/:id - Update production order
  async update(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const order = await productionOrderService.update(id, req.body, userId);

    res.status(200).json({
      success: true,
      data: order,
      message: 'Production order updated successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/production-orders/:id/start - Start production
  async start(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await productionOrderService.start(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: result.order,
      meta: {
        stockTransaction: {
          id: result.stockTransaction.id,
          code: result.stockTransaction.transactionCode,
        },
      },
      message: 'Quá trình sản xuất đã bắt đầu thành công. Nguyên liệu đã được xuất kho.',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/production-orders/:id/complete - Complete production
  async complete(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await productionOrderService.complete(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: result.order,
      meta: {
        stockTransaction: {
          id: result.stockTransaction.id,
          code: result.stockTransaction.transactionCode,
        },
        totalWastage: result.totalWastage,
      },
      message: 'Quá trình sản xuất đã hoàn tất thành công. Thành phẩm đã được nhập kho.',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/production-orders/:id/cancel - Cancel production order
  async cancel(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await productionOrderService.cancel(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: result.order,
      ...(result.materialRollback && {
        warnings: {
          materialRollback: result.materialRollback,
        },
      }),
      message: 'Production order cancelled successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/production-orders/:id/wastage - Get wastage report
  async getWastageReport(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const report = await productionOrderService.getWastageReport(id);

    res.status(200).json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  }

  // DELETE /api/production-orders/:id - Delete production order
  async delete(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await productionOrderService.delete(id, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export default new ProductionOrderController();
