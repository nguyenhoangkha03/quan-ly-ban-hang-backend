import { PrismaClient, Prisma } from '@prisma/client';
import { hashPassword } from '@utils/password';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import RedisService from './redis.service';
import { logActivity } from '@utils/logger';
import uploadService from './upload.service';
import type {
  CreateUserInput,
  UpdateUserInput,
  UpdateUserStatusInput,
  QueryUsersInput,
} from '@validators/user.validator';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

// Cache settings
const USER_CACHE_TTL = 3600;
const USER_LIST_CACHE_TTL = 300;

class UserService {
  // Get all users with pagination, filters, and search
  async getAllUsers(query: QueryUsersInput) {
    const {
      page = '1',
      limit = '20',
      search,
      roleId,
      warehouseId,
      status,
      gender,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build cache key
    const cacheKey = `users:list:${JSON.stringify(query)}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached; // Redis already parses JSON
    }

    // Build where clause
    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          { fullName: { contains: search } },
          { email: { contains: search } },
          { employeeCode: { contains: search } },
          { phone: { contains: search } },
        ],
      }),
      ...(roleId && { roleId: parseInt(roleId) }),
      ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
      ...(status && { status }),
      ...(gender && { gender }),
    };

    // Execute queries in parallel
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          employeeCode: true,
          email: true,
          fullName: true,
          phone: true,
          address: true,
          gender: true,
          dateOfBirth: true,
          avatarUrl: true,
          roleId: true,
          warehouseId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
          role: {
            select: {
              id: true,
              roleKey: true,
              roleName: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              warehouseCode: true,
              warehouseName: true,
              warehouseType: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const result = {
      data: users,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    // Cache result
    await redis.set(cacheKey, result, USER_LIST_CACHE_TTL); // Redis auto-stringifies

    return result;
  }

  // Get user by ID
  async getUserById(id: number) {
    // Check cache
    const cacheKey = `user:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached; // Redis already parses JSON
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeCode: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        roleId: true,
        warehouseId: true,
        status: true,
        createdBy: true,
        updatedBy: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        role: {
          select: {
            id: true,
            roleKey: true,
            roleName: true,
            description: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
            address: true,
            city: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Cache result
    await redis.set(cacheKey, user, USER_CACHE_TTL); // Redis auto-stringifies

    return user;
  }

  // Create new user
  async createUser(data: CreateUserInput, createdBy: number) {
    // Check if email already exists
    const emailExists = await this.checkEmailExists(data.email);
    if (emailExists) {
      throw new ConflictError('Email already exists');
    }

    // Check if employee code already exists
    const employeeCodeExists = await this.checkEmployeeCodeExists(data.employeeCode);
    if (employeeCodeExists) {
      throw new ConflictError('Employee code already exists');
    }

    // Verify role exists
    const roleExists = await prisma.role.findUnique({
      where: { id: data.roleId },
    });
    if (!roleExists) {
      throw new NotFoundError('Role not found');
    }

    // Verify warehouse exists (if provided)
    if (data.warehouseId) {
      const warehouseExists = await prisma.warehouse.findUnique({
        where: { id: data.warehouseId },
      });
      if (!warehouseExists) {
        throw new NotFoundError('Warehouse not found');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        employeeCode: data.employeeCode,
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone || null,
        address: data.address || null,
        gender: data.gender || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        roleId: data.roleId,
        warehouseId: data.warehouseId || null,
        status: data.status || 'active',
        createdBy,
      },
      select: {
        id: true,
        employeeCode: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        roleId: true,
        warehouseId: true,
        status: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            roleKey: true,
            roleName: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
      },
    });

    // Log activity
    logActivity('create', createdBy, 'users', {
      recordId: user.id,
      newValue: { ...user, passwordHash: '[HIDDEN]' },
    });

    // Invalidate list cache
    await this.invalidateListCache();

    return user;
  }

  // Update user
  async updateUser(id: number, data: UpdateUserInput, updatedBy: number) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Check email uniqueness (if changing)
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await this.checkEmailExists(data.email, id);
      if (emailExists) {
        throw new ConflictError('Email already exists');
      }
    }

    // Check employee code uniqueness (if changing)
    if (data.employeeCode && data.employeeCode !== existingUser.employeeCode) {
      const employeeCodeExists = await this.checkEmployeeCodeExists(data.employeeCode, id);
      if (employeeCodeExists) {
        throw new ConflictError('Employee code already exists');
      }
    }

    // Verify role exists (if changing)
    if (data.roleId) {
      const roleExists = await prisma.role.findUnique({
        where: { id: data.roleId },
      });
      if (!roleExists) {
        throw new NotFoundError('Role not found');
      }
    }

    // Verify warehouse exists (if changing)
    if (data.warehouseId) {
      const warehouseExists = await prisma.warehouse.findUnique({
        where: { id: data.warehouseId },
      });
      if (!warehouseExists) {
        throw new NotFoundError('Warehouse not found');
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(data.employeeCode && { employeeCode: data.employeeCode }),
        ...(data.email && { email: data.email }),
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.dateOfBirth !== undefined && {
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        }),
        ...(data.roleId && { roleId: data.roleId }),
        ...(data.warehouseId !== undefined && { warehouseId: data.warehouseId }),
        updatedBy,
      },
      select: {
        id: true,
        employeeCode: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        roleId: true,
        warehouseId: true,
        status: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            roleKey: true,
            roleName: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
      },
    });

    // Log activity
    logActivity('update', updatedBy, 'users', {
      recordId: id,
      oldValue: existingUser,
      newValue: updatedUser,
    });

    // Invalidate cache
    await redis.del(`user:${id}`);
    await this.invalidateListCache();

    return updatedUser;
  }

  // Delete user (soft delete - set status to inactive)
  async deleteUser(id: number, deletedBy: number) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Prevent deleting self
    if (id === deletedBy) {
      throw new ValidationError('Cannot delete your own account');
    }

    // Soft delete by setting status to inactive
    await prisma.user.update({
      where: { id },
      data: {
        status: 'inactive',
        updatedBy: deletedBy,
      },
    });

    // Log activity
    logActivity('delete', deletedBy, 'users', {
      recordId: id,
      oldValue: user,
    });

    // Invalidate cache
    await redis.del(`user:${id}`);
    await this.invalidateListCache();

    return { message: 'User deleted successfully' };
  }

  // Update user status (lock/unlock)
  async updateUserStatus(id: number, data: UpdateUserStatusInput, updatedBy: number) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Prevent changing own status
    if (id === updatedBy) {
      throw new ValidationError('Cannot change your own status');
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        status: data.status,
        updatedBy,
      },
      select: {
        id: true,
        employeeCode: true,
        email: true,
        fullName: true,
        status: true,
        updatedAt: true,
      },
    });

    // Log activity
    logActivity('update', updatedBy, 'users', {
      recordId: id,
      action: 'status_change',
      oldValue: { status: user.status },
      newValue: { status: data.status },
      reason: data.reason,
    });

    // Invalidate cache
    await redis.del(`user:${id}`);
    await this.invalidateListCache();

    return updatedUser;
  }

  // Upload avatar
  async uploadAvatar(userId: number, file: Express.Multer.File) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Process and save avatar
    const avatarUrl = await uploadService.processAvatar(file.path, userId);

    // Delete old avatar if exists
    if (user.avatarUrl) {
      await uploadService.deleteAvatar(user.avatarUrl);
    }

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    // Invalidate cache
    await redis.del(`user:${userId}`);

    return updatedUser;
  }

  // Delete avatar
  async deleteAvatar(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.avatarUrl) {
      throw new ValidationError('User does not have an avatar');
    }

    // Delete avatar file
    await uploadService.deleteAvatar(user.avatarUrl);

    // Update user to remove avatar URL
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    // Invalidate cache
    await redis.del(`user:${userId}`);

    return { message: 'Avatar deleted successfully' };
  }

  // Check if email exists
  async checkEmailExists(email: string, excludeUserId?: number): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        email,
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
    });

    return !!user;
  }

  // Check if employee code exists
  async checkEmployeeCodeExists(code: string, excludeUserId?: number): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        employeeCode: code,
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
    });

    return !!user;
  }

  // Invalidate list cache
  private async invalidateListCache() {
    const keys = await redis.keys('users:list:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  }
}

export default new UserService();
