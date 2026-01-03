import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import supplierService from '@services/supplier.service';
import { ApiResponse } from '@custom-types/common.type';

class SupplierController {
  // GET /api/suppliers
  async getAllSuppliers(req: AuthRequest, res: Response) {
    const result = await supplierService.getAllSuppliers(req.query as any);

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      cards: result.cards,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/suppliers/:id
  async getSupplierById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const supplier = await supplierService.getSupplierById(id);

    const response: ApiResponse = {
      success: true,
      data: supplier,
      message: 'Success',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/suppliers
  async createSupplier(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const supplier = await supplierService.createSupplier(req.body, userId);

    const response: ApiResponse = {
      success: true,
      data: supplier,
      message: 'Supplier created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/suppliers/:id
  async updateSupplier(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const supplier = await supplierService.updateSupplier(id, req.body, userId);

    const response: ApiResponse = {
      success: true,
      data: supplier,
      message: 'Supplier updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // DELETE /api/suppliers/:id
  async deleteSupplier(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await supplierService.deleteSupplier(id, userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new SupplierController();
