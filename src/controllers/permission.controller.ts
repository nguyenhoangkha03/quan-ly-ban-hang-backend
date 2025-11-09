import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/index';
import permissionService from '@services/permission.service';

class PermissionController {
  // GET /api/permissions - Get all permissions (grouped by module)
  async getAllPermissions(_req: AuthRequest, res: Response) {
    const result = await permissionService.getAllPermissions();

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // GET /api/permissions/module/:module - Get permissions by module
  async getPermissionsByModule(req: AuthRequest, res: Response) {
    const module = req.params.module;

    const permissions = await permissionService.getPermissionsByModule(module);

    const response: ApiResponse = {
      success: true,
      data: permissions,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }
}

export default new PermissionController();
