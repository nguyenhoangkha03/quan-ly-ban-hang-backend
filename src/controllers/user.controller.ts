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
  // GET /api/users/me - Get current user profile
  async getMe(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const user = await userService.getUserById(userId);

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'Lấy thông tin thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/users - Get all users with pagination & filters
  async getAllUsers(req: AuthRequest, res: Response) {
    const query = req.query as unknown as QueryUsersInput;

    const result = await userService.getAllUsers(query);

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'Lấy danh sách nhân viên thành công!',
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
      message: 'Lấy thông tin nhân viên thành công!',
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
      message: 'Tạo nhân viên thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/users/:id - Update user
  async updateUser(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const data = req.body as UpdateUserInput;
    const updatedBy = req.user!.id;

    const user = await userService.updateUser(userId, data, updatedBy);

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'Cập nhật nhân viên thành công!',
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
      message: result.message,
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
      message: 'Cập nhật trạng thái nhân viên thành công!',
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
          message: 'Bạn chỉ có thể tải lên ảnh đại diện cho hồ sơ của chính mình',
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
          message: 'Chưa tải lên file nào',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const result = await userService.uploadAvatar(userId, req.file);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Tải lên ảnh đại diện thành công!',
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
          message: 'Bạn chỉ có thể xóa ảnh đại diện cho hồ sơ của chính mình',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(403).json(response);
    }

    const result = await userService.deleteAvatar(userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // PATCH /api/users/:id - Toggle Can Edit Profile
  async toggleCanEditProfile(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const { canEditProfile } = req.body as { canEditProfile: boolean };
    const updatedBy = req.user!.id;

    if (typeof canEditProfile !== 'boolean') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'canEditProfile phải là boolean',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const result = await userService.toggleCanEditProfile(userId, canEditProfile, updatedBy);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: `${canEditProfile ? 'Cho phép' : 'Tắt'} chỉnh sửa hồ sơ thành công!`,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // PUT /api/users/:id/password - Change user password (admin only)
  async changePassword(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const { password } = req.body as { password: string };
    const changedBy = req.user!.id;

    if (!password) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Mật khẩu không được để trống',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const result = await userService.changePassword(userId, password, changedBy);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Cập nhật mật khẩu thành công!',
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  // GET /api/users/:id/activity-logs - Get user activity logs
  async getActivityLogs(req: AuthRequest, res: Response) {
    const userId = parseInt(req.params.id);
    const limitParam = req.query.limit as string | undefined;
    const offsetParam = req.query.offset as string | undefined;

    const limitNum = Math.min(parseInt(limitParam || '50') || 50, 100);
    const offsetNum = parseInt(offsetParam || '0') || 0;

    const result = await userService.getActivityLogs(userId, {
      limit: limitNum,
      offset: offsetNum,
    });

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'Lấy nhật ký hoạt động thành công!',
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
