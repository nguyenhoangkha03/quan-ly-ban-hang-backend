import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import deliveryService from '@services/delivery.service';

class DeliveryController {
  // GET /api/deliveries - Get all deliveries
  async getAll(req: AuthRequest, res: Response) {
    const result = await deliveryService.getAll(req.query as any);

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/deliveries/:id - Get delivery by ID
  async getById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const delivery = await deliveryService.getById(id);

    res.status(200).json({
      success: true,
      data: delivery,
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/deliveries - Create new delivery
  async create(req: AuthRequest, res: Response) {
    const delivery = await deliveryService.create(req.body);

    res.status(201).json({
      success: true,
      data: delivery,
      message: 'Delivery created successfully. Order status updated to delivering.',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/deliveries/:id - Update delivery
  async update(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const delivery = await deliveryService.update(id, req.body, userId);

    res.status(200).json({
      success: true,
      data: delivery,
      message: 'Delivery updated successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/deliveries/:id/start - Start delivery
  async start(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const delivery = await deliveryService.start(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: delivery,
      message: 'Delivery started successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/deliveries/:id/complete - Complete delivery
  async complete(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const delivery = await deliveryService.complete(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: delivery,
      message: 'Delivery completed successfully. Order completed and payment processed.',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/deliveries/:id/fail - Fail delivery
  async fail(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const delivery = await deliveryService.fail(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: delivery,
      message: 'Delivery marked as failed',
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/deliveries/:id/settle - Settle COD
  async settleCOD(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const delivery = await deliveryService.settleCOD(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: delivery,
      message: 'COD amount settled successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/deliveries/unsettled-cod - Get unsettled COD deliveries
  async getUnsettledCOD(_req: AuthRequest, res: Response) {
    const result = await deliveryService.getUnsettledCOD();

    res.status(200).json({
      success: true,
      data: result.deliveries,
      summary: result.summary,
      timestamp: new Date().toISOString(),
    });
  }

  // DELETE /api/deliveries/:id - Delete delivery
  async delete(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await deliveryService.delete(id, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export default new DeliveryController();
