import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '@utils/errors';
import RedisService from './redis.service';
import { logActivity } from '@utils/logger';
import { invalidatePermissionCache } from '@middlewares/authorize';
import type { AssignPermissionsInput } from '@validators/role.validator';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

// Cache settings
const ROLE_CACHE_TTL = 3600;

class RoleService {
  // Get all roles
  async getAllRoles() {
    const roles = await prisma.role.findMany({
      orderBy: { roleName: 'asc' },
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

    return roles;
  }

  // Get role by ID
  async getRoleById(id: number) {
    // Check cache
    const cacheKey = `role:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

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
      throw new NotFoundError('Role not found');
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
      throw new NotFoundError('Role not found');
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
      throw new NotFoundError('Role not found');
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
      throw new NotFoundError('One or more permissions not found');
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
    await redis.del(`role:permissions:${roleId}`);
    await redis.del(`role:${roleId}`);
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
      throw new NotFoundError('Role not found');
    }

    // Verify permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundError('Permission not found');
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
      return { message: 'Permission already assigned to this role' };
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
    await redis.del(`role:permissions:${roleId}`);
    await invalidatePermissionCache(roleId);

    return { message: 'Permission added successfully' };
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
      throw new NotFoundError('Permission assignment not found');
    }

    // Log activity
    logActivity('delete', removedBy, 'role_permissions', {
      recordId: roleId,
      action: 'remove_permission',
      oldValue: { permissionId },
    });

    // Invalidate caches
    await redis.del(`role:permissions:${roleId}`);
    await invalidatePermissionCache(roleId);

    return { message: 'Permission removed successfully' };
  }
}

export default new RoleService();
