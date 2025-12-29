import { Prisma, PrismaClient, RoleStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import RedisService from './redis.service';
import { logActivity } from '@utils/logger';
import { invalidatePermissionCache } from '@middlewares/authorize';
import type {
  AssignPermissionsInput,
  CreateRoleInput,
  QueryRolesInput,
  UpdateRoleInput,
} from '@validators/role.validator';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

// Cache settings
const ROLE_CACHE_TTL = 3600;
const ROLE_LIST_CACHE_TTL = 3600;

class RoleService {
  async getAllRoles(query: QueryRolesInput) {
    const {
      page = '1',
      limit = '20',
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Tạo khóa cache cho nhất quán
    const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : 'default';
    const cacheKey = `role:list:${queryString}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`✅ Có cache: ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Không có cache: ${cacheKey}, truy vấn database...`);

    const where: Prisma.RoleWhereInput = {
      ...(search && {
        OR: [
          { roleKey: { contains: search } },
          { roleName: { contains: search } },
          { description: { contains: search } },
        ],
      }),
      ...(status && { status }),
    };

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          roleKey: true,
          roleName: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              rolePermissions: true,
            },
          },
        },
      }),
      prisma.role.count({ where }),
    ]);

    const result = {
      data: roles,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'Success',
    };

    await redis.set(cacheKey, result, ROLE_LIST_CACHE_TTL);

    return result;
  }

  // Create new role
  async createRole(data: CreateRoleInput, createdBy: number) {
    // Check if roleKey already exists
    const existing = await prisma.role.findUnique({
      where: { roleKey: data.roleKey },
    });

    if (existing) {
      throw new ValidationError(`Role key "${data.roleKey}" đã tồn tại`);
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        roleKey: data.roleKey,
        roleName: data.roleName,
        description: data.description || null,
        status: (data.status || 'active') as RoleStatus,
      },
      select: {
        id: true,
        roleKey: true,
        roleName: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log activity
    logActivity('create', createdBy, 'roles', {
      recordId: role.id,
      roleKey: role.roleKey,
      roleName: role.roleName,
    });

    // Invalidate list cache
    await redis.flushPattern('role:*');

    return role;
  }

  // Update role
  async updateRole(id: number, data: UpdateRoleInput, updatedBy: number) {
    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundError('Role không tìm thấy');
    }

    // Don't allow updating roleKey (system field)
    if (role.roleKey === 'admin') {
      throw new ValidationError('Không thể cập nhật vai trò hệ thống');
    }

    // Update role
    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        ...(data.roleName && { roleName: data.roleName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status as RoleStatus }),
      },
      select: {
        id: true,
        roleKey: true,
        roleName: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            rolePermissions: true,
          },
        },
      },
    });

    // Log activity
    logActivity('update', updatedBy, 'roles', {
      recordId: id,
      roleKey: role.roleKey,
      changes: data,
    });

    // Invalidate caches
    await redis.del(`role:${id}`);
    await redis.del(`role:permissions:${id}`);
    await redis.flushPattern('role:*');

    return updatedRole;
  }

  // Delete role
  async deleteRole(id: number, deletedBy: number) {
    // Verify role exists and get user count
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundError('Role không tìm thấy');
    }

    // Don't allow deleting system roles
    if (['admin', 'user'].includes(role.roleKey)) {
      throw new ValidationError(`Không thể xóa role hệ thống "${role.roleName}"`);
    }

    // Check if role is assigned to users
    if (role._count.users > 0) {
      throw new ValidationError(
        `Không thể xóa role "${role.roleName}" nó đã được gán với ${role._count.users} user(s). Vui lòng gỡ gán user trước.`
      );
    }

    // Delete role (cascade will delete role_permissions)
    await prisma.role.delete({
      where: { id },
    });

    // Log activity
    logActivity('delete', deletedBy, 'roles', {
      recordId: id,
      roleKey: role.roleKey,
      roleName: role.roleName,
    });

    // Invalidate caches
    await redis.del(`role:${id}`);
    await redis.del(`role:permissions:${id}`);
    await redis.flushPattern('role:*');

    return { message: 'Role xóa thành công' };
  }

  // Get role by ID
  async getRoleById(id: number) {
    // Check cache
    const cacheKey = `role:${id}`;

    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`✅ Có cache ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Không có cache ${cacheKey}, truy vấn database...`);

    const role = await prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        roleKey: true,
        roleName: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            rolePermissions: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundError('Role không tìm thấy');
    }

    // Cache result
    await redis.set(cacheKey, role, ROLE_CACHE_TTL);

    return role;
  }

  // Get role permissions
  async getRolePermissions(roleId: number) {
    // Check cache
    const cacheKey = `role:permissions:${roleId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundError('Vai trò không tìm thấy');
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: {
          select: {
            id: true,
            permissionKey: true,
            permissionName: true,
            description: true,
            module: true,
          },
        },
      },
      orderBy: {
        permission: {
          permissionName: 'asc',
        },
      },
    });

    const permissions = rolePermissions.map((rp) => rp.permission);

    // Group by module
    const grouped = permissions.reduce((acc: any, permission) => {
      const module = permission.module || 'general';
      if (!acc[module]) {
        acc[module] = [];
      }
      acc[module].push(permission);
      return acc;
    }, {});

    const result = {
      role: {
        id: role.id,
        roleKey: role.roleKey,
        roleName: role.roleName,
      },
      permissions,
      grouped,
      total: permissions.length,
    };

    // Cache result
    await redis.set(cacheKey, result, ROLE_CACHE_TTL);

    return result;
  }

  // Assign permissions to role (replace all)
  async assignPermissions(roleId: number, data: AssignPermissionsInput, assignedBy: number) {
    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundError('Vai trò không tìm thấy');
    }

    // Verify all permission IDs exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: {
          in: data.permissionIds,
        },
      },
    });

    if (permissions.length !== data.permissionIds.length) {
      throw new NotFoundError('Không tìm thấy một hoặc nhiều quyền.');
    }

    // Get current permissions for logging
    const currentPermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });

    // Use transaction to delete old and create new
    await prisma.$transaction(async (tx) => {
      // Delete all existing permissions for this role
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Create new permissions
      await tx.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
          assignedBy,
        })),
      });
    });

    // Log activity
    logActivity('update', assignedBy, 'role_permissions', {
      recordId: roleId,
      action: 'assign_permissions',
      oldValue: { permissionIds: currentPermissions.map((p) => p.permissionId) },
      newValue: { permissionIds: data.permissionIds },
    });

    // Invalidate caches
    await redis.flushPattern(`role:*`);
    await invalidatePermissionCache(roleId);

    // Get updated permissions
    const result = await this.getRolePermissions(roleId);

    return result;
  }

  // Add single permission to role
  async addPermission(roleId: number, permissionId: number, assignedBy: number) {
    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundError('Vai trò không tìm thấy');
    }

    // Verify permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundError('Quyền không tìm thấy');
    }

    // Check if already assigned
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (existing) {
      return { message: 'Quyền hạn đã được cấp cho vai trò này' };
    }

    // Create role permission
    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
        assignedBy,
      },
    });

    // Log activity
    logActivity('create', assignedBy, 'role_permissions', {
      recordId: roleId,
      action: 'add_permission',
      newValue: { permissionId },
    });

    // Invalidate caches
    await redis.flushPattern(`role:*`);
    await invalidatePermissionCache(roleId);

    return { message: 'Đã thêm quyền thành công' };
  }

  // Remove single permission from role
  async removePermission(roleId: number, permissionId: number, removedBy: number) {
    const deleted = await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (!deleted) {
      throw new NotFoundError('Không tìm thấy quyền phân bổ.');
    }

    // Log activity
    logActivity('delete', removedBy, 'role_permissions', {
      recordId: roleId,
      action: 'remove_permission',
      oldValue: { permissionId },
    });

    // Invalidate caches
    await redis.flushPattern(`role:*`);
    await invalidatePermissionCache(roleId);

    return { message: 'Đã xóa quyền thành công' };
  }
}

export default new RoleService();
