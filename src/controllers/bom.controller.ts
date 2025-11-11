import { Response } from 'express';
import { AuthRequest } from '@custom-types/index';
import bomService from '@services/bom.service';

class BomController {
  // GET /api/bom - Get all BOMs
  async getAll(req: AuthRequest, res: Response) {
    const result = await bomService.getAll(req.query as any);

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/bom/:id - Get BOM by ID
  async getById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const bom = await bomService.getById(id);

    res.status(200).json({
      success: true,
      data: bom,
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/bom - Create new BOM
  async create(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const bom = await bomService.create(req.body, userId);

    res.status(201).json({
      success: true,
      data: bom,
      message: 'BOM created successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/bom/:id - Update BOM
  async update(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const bom = await bomService.update(id, req.body, userId);

    res.status(200).json({
      success: true,
      data: bom,
      message: 'BOM updated successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // DELETE /api/bom/:id - Delete BOM
  async delete(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await bomService.delete(id, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/bom/:id/approve - Approve BOM
  async approve(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const { notes } = req.body;
    const bom = await bomService.approve(id, userId, notes);

    res.status(200).json({
      success: true,
      data: bom,
      message: 'BOM approved successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/bom/calculate - Calculate material requirements
  async calculateMaterials(req: AuthRequest, res: Response) {
    const result = await bomService.calculateMaterials(req.body);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/bom/product/:productId - Get BOMs by finished product
  async getByFinishedProduct(req: AuthRequest, res: Response) {
    const productId = parseInt(req.params.productId);
    const boms = await bomService.getByFinishedProduct(productId);

    res.status(200).json({
      success: true,
      data: boms,
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/bom/:id/inactive - Set BOM to inactive
  async setInactive(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const { reason } = req.body;
    const bom = await bomService.setInactive(id, userId, reason);

    res.status(200).json({
      success: true,
      data: bom,
      message: 'BOM set to inactive successfully',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new BomController();
