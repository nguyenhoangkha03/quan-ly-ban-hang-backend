import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/common.type';
import userPermissionService from '@services/user-permission.service';

class UserPermissionController {
  // GET /api/users/:id/permissions - Get user's direct permissions
  async getUserPermissions(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);

    const permissions = await userPermissionService.getUserPermissions(userId);

    const response: ApiResponse = {
      success: true,
      data: permissions,
      message: 'Lấy quyền người dùng thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/users/:id/permissions - Assign permission to user
  async assignUserPermission(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const { permissionId, grantType } = req.body;
    const assignedBy = req.user!.id;

    const permission = await userPermissionService.assignUserPermission(
      userId,
      { permissionId, grantType },
      assignedBy
    );

    const response: ApiResponse = {
      success: true,
      data: permission,
      message: 'Gán quyền thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // DELETE /api/users/:id/permissions/:permissionId - Revoke permission from user
  async revokeUserPermission(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const permissionId = parseInt(req.params.permissionId);

    const result = await userPermissionService.revokeUserPermission(userId, permissionId);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Xóa quyền thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/users/:id/permissions/effective - Get effective permissions (role + user-specific)
  async getEffectivePermissions(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);

    const permissions = await userPermissionService.getUserEffectivePermissions(userId);

    const response: ApiResponse = {
      success: true,
      data: permissions,
      message: 'Lấy quyền thực tế thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new UserPermissionController();
