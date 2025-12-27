import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/common.type';
import roleService from '@services/role.service';
import type { AssignPermissionsInput, UpdateRoleInput } from '@validators/role.validator';

class RoleController {
  // GET /api/roles - Get all roles
  async getAllRoles(req: AuthRequest, res: Response) {
    const result = await roleService.getAllRoles(req.query as any);

    const response: ApiResponse = {
      success: true,
      message: result.message,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/roles - Create new role
  async createRole(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const result = await roleService.createRole(req.body, userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Tạo role thành công',
      timestamp: new Date().toISOString(),
    };

    return res.status(201).json(response);
  }

  // PUT /api/roles/:id - Update role
  async updateRole(req: AuthRequest, res: Response) {
    const roleId = parseInt(req.params.id);
    const data = req.body as UpdateRoleInput;
    const updatedBy = req.user!.id;

    const result = await roleService.updateRole(roleId, data, updatedBy);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Role cập nhật thành công!',
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // DELETE /api/roles/:id - Delete role
  async deleteRole(req: AuthRequest, res: Response) {
    const roleId = parseInt(req.params.id);
    const deletedBy = req.user!.id;

    const result = await roleService.deleteRole(roleId, deletedBy);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Xóa vai trò thành công!',
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
      message: 'Phân quyền thành cong',
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
