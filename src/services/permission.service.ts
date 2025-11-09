import { PrismaClient } from '@prisma/client';
import RedisService from './redis.service';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

// Cache settings
const PERMISSION_CACHE_TTL = 3600;

class PermissionService {
  // Get all permissions (optionally grouped by module)
  async getAllPermissions() {
    const cacheKey = 'permissions:all';
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { permissionName: 'asc' }],
      select: {
        id: true,
        permissionKey: true,
        permissionName: true,
        description: true,
        module: true,
        createdAt: true,
      },
    });

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
      permissions,
      grouped,
    };

    // Cache result
    await redis.set(cacheKey, result, PERMISSION_CACHE_TTL);

    return result;
  }

  // Get permissions by module
  async getPermissionsByModule(module: string) {
    const allPermissions = await this.getAllPermissions();
    const modulePermissions = allPermissions.grouped[module] || [];

    return modulePermissions;
  }

  // Check if user has permission
  async checkUserPermission(userId: number, permissionKey: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.role) {
      return false;
    }

    const hasPermission = user.role.rolePermissions.some(
      (rp) => rp.permission.permissionKey === permissionKey
    );

    return hasPermission;
  }

  // Invalidate all permissions cache
  async invalidateCache() {
    await redis.del('permissions:all');
  }
}

export default new PermissionService();
