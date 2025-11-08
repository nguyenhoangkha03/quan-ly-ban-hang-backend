import { NextFunction, Response } from 'express';
import { AuthRequest } from '@custom-types/index';
import { asyncHandler } from './errorHandler';
import { PrismaClient } from '@prisma/client';
import { AuthenticationError, AuthorizationError } from '@utils/errors';
import RedisService from '@services/redis.service';
import { verifyAccessToken } from '@utils/jwt';

const prisma = new PrismaClient();

const redis = RedisService.getInstance();

export const authentication = asyncHandler(
  async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provider');
    }

    const token = authHeader.substring(7);

    const isBlacklisted = await redis.get(`blacklist:${token}`);

    if (isBlacklisted) {
      throw new AuthenticationError('Token has been revoked');
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        employeeCode: true,
        roleId: true,
        warehouseId: true,
        status: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (user.status === 'locked') {
      throw new AuthorizationError('Account is locked');
    }

    if (user.status === 'inactive') {
      throw new AuthorizationError('Account is inactive');
    }

    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      warehouseId: user.warehouseId || undefined,
      employeeCode: user.employeeCode,
    };

    next();
  }
);

export const optionalAuth = asyncHandler(
  async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyAccessToken(token);

        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            email: true,
            employeeCode: true,
            roleId: true,
            warehouseId: true,
            status: true,
          },
        });

        if (user && user.status === 'active') {
          req.user = {
            id: user.id,
            email: user.email,
            roleId: user.roleId,
            warehouseId: user.warehouseId || undefined,
            employeeCode: user.employeeCode,
          };
        }
      } catch (error) {
        // Ignore errors for optional auth
      }
    }

    next();
  }
);
