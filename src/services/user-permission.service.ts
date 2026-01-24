import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';

const prisma = new PrismaClient();

interface AssignUserPermissionInput {
  permissionId: number;
  grantType?: 'grant' | 'revoke';
}

class UserPermissionService {
  // Get user's direct permissions (both granted and revoked)
  async getUserPermissions(userId: number) {
    const permissions = await prisma.userPermission.findMany({
      where: { userId },
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
        assigner: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return permissions.map((p) => ({
      userId: p.userId,
      permissionId: p.permissionId,
      permissionKey: p.permission.permissionKey,
      permissionName: p.permission.permissionName,
      grantType: p.grantType,
      assignedAt: p.assignedAt,
      assignedBy: p.assigner,
    }));
  }

  // Assign permission to user
  async assignUserPermission(userId: number, data: AssignUserPermissionInput, assignedBy: number) {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User');
    }

    // Verify permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: data.permissionId },
    });
    if (!permission) {
      throw new NotFoundError('Permission');
    }

    // Create or update user permission
    const userPermission = await prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: data.permissionId,
        },
      },
      create: {
        userId,
        permissionId: data.permissionId,
        grantType: data.grantType || 'grant',
        assignedBy,
      },
      update: {
        grantType: data.grantType || 'grant',
        assignedAt: new Date(),
        assignedBy,
      },
      include: {
        permission: true,
        assigner: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return userPermission;
  }

  // Revoke permission from user
  async revokeUserPermission(userId: number, permissionId: number) {
    const userPermission = await prisma.userPermission.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });

    if (!userPermission) {
      throw new ValidationError('Quyền này chưa được gán cho người dùng');
    }

    await prisma.userPermission.delete({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });

    return { message: 'Xóa quyền thành công' };
  }

  // Get effective permissions for user (role + user-specific)
  async getUserEffectivePermissions(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: {
                  select: {
                    id: true,
                    permissionKey: true,
                    permissionName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Get role permissions
    const rolePermissionKeys = new Set(
      user.role.rolePermissions.map((rp) => rp.permission.permissionKey)
    );

    // Get user-specific permissions
    const userPermissions = await prisma.userPermission.findMany({
      where: { userId },
      include: {
        permission: {
          select: {
            permissionKey: true,
            permissionName: true,
          },
        },
      },
    });

    // Merge permissions
    const effectivePermissions = new Set<string>();

    // Add all role permissions
    rolePermissionKeys.forEach((key) => effectivePermissions.add(key));

    // Apply user-specific grants/revokes
    userPermissions.forEach((up) => {
      if (up.grantType === 'grant') {
        effectivePermissions.add(up.permission.permissionKey);
      } else if (up.grantType === 'revoke') {
        effectivePermissions.delete(up.permission.permissionKey);
      }
    });

    return {
      userId,
      rolePermissions: Array.from(rolePermissionKeys),
      userPermissions: userPermissions.map((up) => ({
        permissionKey: up.permission.permissionKey,
        grantType: up.grantType,
      })),
      effectivePermissions: Array.from(effectivePermissions),
    };
  }
}

export default new UserPermissionService();
