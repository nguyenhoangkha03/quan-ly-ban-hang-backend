import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/index';
import roleService from '@services/role.service';
import type { AssignPermissionsInput } from '@validators/role.validator';

class RoleController {
  // GET /api/roles - Get all roles
  async getAllRoles(_req: AuthRequest, res: Response) {
    const roles = await roleService.getAllRoles();

    const response: ApiResponse = {
      success: true,
      data: roles,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // GET /api/roles/:id - Get role by ID
  async getRoleById(req: AuthRequest, res: Response) {
    const roleId = parseInt(req.params.id);

    const role = await roleService.getRoleById(roleId);

    const response: ApiResponse = {
      success: true,
      data: role,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // GET /api/roles/:id/permissions - Get role permissions
  async getRolePermissions(req: AuthRequest, res: Response) {
    const roleId = parseInt(req.params.id);

    const result = await roleService.getRolePermissions(roleId);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // PUT /api/roles/:id/permissions - Assign permissions to role (admin only)
  async assignPermissions(req: AuthRequest, res: Response) {
    const roleId = parseInt(req.params.id);
    const data = req.body as AssignPermissionsInput;
    const assignedBy = req.user!.id;

    const result = await roleService.assignPermissions(roleId, data, assignedBy);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Permissions assigned successfully',
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // POST /api/roles/:id/permissions/:permissionId - Add single permission
  async addPermission(req: AuthRequest, res: Response) {
    const roleId = parseInt(req.params.id);
    const permissionId = parseInt(req.params.permissionId);
    const assignedBy = req.user!.id;

    const result = await roleService.addPermission(roleId, permissionId, assignedBy);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // DELETE /api/roles/:id/permissions/:permissionId - Remove single permission
  async removePermission(req: AuthRequest, res: Response) {
    const roleId = parseInt(req.params.id);
    const permissionId = parseInt(req.params.permissionId);
    const removedBy = req.user!.id;

    const result = await roleService.removePermission(roleId, permissionId, removedBy);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }
}

export default new RoleController();
