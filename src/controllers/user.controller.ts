import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/common.type';
import userService from '@services/user.service';
import type {
  CreateUserInput,
  UpdateUserInput,
  UpdateUserStatusInput,
  QueryUsersInput,
} from '@validators/user.validator';

class UserController {
  // GET /api/users - Get all users with pagination & filters
  async getAllUsers(req: AuthRequest, res: Response) {
    const query = req.query as unknown as QueryUsersInput;

    const result = await userService.getAllUsers(query);

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/users/:id - Get user by ID
  async getUserById(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);

    const user = await userService.getUserById(userId);

    const response: ApiResponse = {
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/users - Create new user (admin only)
  async createUser(req: AuthRequest, res: Response) {
    const data = req.body as CreateUserInput;
    const createdBy = req.user!.id;

    const user = await userService.createUser(data, createdBy);

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'User created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/users/:id - Update user
  async updateUser(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const data = req.body as UpdateUserInput;
    const updatedBy = req.user!.id;

    // Check if user is updating own profile or is admin
    const userRole = await this.getUserRole(req.user!.roleId);

    if (userRole !== 'admin' && userId !== updatedBy) {
      // Non-admin can only update own profile
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own profile',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(403).json(response);
    }

    // Non-admin cannot change roleId
    if (userRole !== 'admin' && data.roleId) {
      delete data.roleId;
    }

    const user = await userService.updateUser(userId, data, updatedBy);

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'User updated successfully',
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // DELETE /api/users/:id - Delete user (soft delete, admin only)
  async deleteUser(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const deletedBy = req.user!.id;

    const result = await userService.deleteUser(userId, deletedBy);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // PATCH /api/users/:id/status - Update user status (admin only)
  async updateUserStatus(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const data = req.body as UpdateUserStatusInput;
    const updatedBy = req.user!.id;

    const user = await userService.updateUserStatus(userId, data, updatedBy);

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'User status updated successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/users/:id/avatar - Upload avatar
  async uploadAvatar(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user!.id;
    const userRole = await this.getUserRole(req.user!.roleId);

    // Check if user can upload avatar for this user
    if (userRole !== 'admin' && userId !== currentUserId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only upload avatar for your own profile',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(403).json(response);
    }

    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file uploaded',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const result = await userService.uploadAvatar(userId, req.file);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Avatar uploaded successfully',
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // DELETE /api/users/:id/avatar - Delete avatar
  async deleteAvatar(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user!.id;
    const userRole = await this.getUserRole(req.user!.roleId);

    // Check if user can delete avatar for this user
    if (userRole !== 'admin' && userId !== currentUserId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete avatar for your own profile',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(403).json(response);
    }

    const result = await userService.deleteAvatar(userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // Helper: Get user role
  private async getUserRole(roleId: number): Promise<string> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { roleKey: true },
    });

    return role?.roleKey || '';
  }
}

export default new UserController();
