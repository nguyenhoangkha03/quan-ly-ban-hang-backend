import { Response } from 'express';
import { AuthRequest } from '@custom-types/index';
import categoryService from '@services/category.service';
import { ApiResponse } from '@custom-types/index';

class CategoryController {
  // GET /api/categories
  async getAllCategories(req: AuthRequest, res: Response) {
    const result = await categoryService.getAllCategories(req.query as any);

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/categories/tree
  async getCategoryTree(_req: AuthRequest, res: Response) {
    const tree = await categoryService.getCategoryTree();

    const response: ApiResponse = {
      success: true,
      data: tree,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/categories/:id
  async getCategoryById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const category = await categoryService.getCategoryById(id);

    const response: ApiResponse = {
      success: true,
      data: category,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/categories
  async createCategory(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const category = await categoryService.createCategory(req.body, userId);

    const response: ApiResponse = {
      success: true,
      data: category,
      message: 'Category created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/categories/:id
  async updateCategory(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const category = await categoryService.updateCategory(id, req.body, userId);

    const response: ApiResponse = {
      success: true,
      data: category,
      message: 'Category updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // DELETE /api/categories/:id
  async deleteCategory(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await categoryService.deleteCategory(id, userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new CategoryController();
