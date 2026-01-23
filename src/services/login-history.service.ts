import { PrismaClient } from '@prisma/client';
import { ValidationError } from '@utils/errors';

const prisma = new PrismaClient();

interface LoginHistoryInput {
  userAgent: string;
  ipAddress: string;
}

class LoginHistoryService {
  // Get login history for current user
  async getLoginHistory(userId: number, limit = 50) {
    const logs = await prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        logoutAt: true,
      },
    });

    return logs;
  }

  // Create login history entry
  async createLoginHistory(userId: number, data: LoginHistoryInput) {
    const log = await prisma.loginHistory.create({
      data: {
        userId,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        logoutAt: true,
      },
    });

    return log;
  }

  // Revoke login sessions (mark as logged out)
  async revokeLoginSessions(userId: number, logIds: number[]) {
    if (!logIds || logIds.length === 0) {
      throw new ValidationError('Vui lòng chọn ít nhất một phiên để đăng xuất');
    }

    // Verify that all logs belong to the current user (security check)
    const existingLogs = await prisma.loginHistory.findMany({
      where: {
        id: { in: logIds },
        userId: userId,
      },
      select: { id: true },
    });

    if (existingLogs.length !== logIds.length) {
      throw new ValidationError('Một số phiên không hợp lệ');
    }

    // Update logs to mark as logged out
    const result = await prisma.loginHistory.updateMany({
      where: {
        id: { in: logIds },
        userId: userId,
      },
      data: {
        logoutAt: new Date(),
      },
    });

    return {
      revokedCount: result.count,
    };
  }

  // Get login stats
  async getLoginStats(userId: number) {
    const [totalLogins, activeSession, lastLogin] = await Promise.all([
      prisma.loginHistory.count({ where: { userId } }),
      prisma.loginHistory.count({
        where: { userId, logoutAt: null },
      }),
      prisma.loginHistory.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      totalLogins,
      activeSessions: activeSession,
      lastLogin: lastLogin?.createdAt,
    };
  }

  // Clean old login history (runs periodically)
  async cleanOldLoginHistory(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.loginHistory.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        logoutAt: { not: null },
      },
    });

    return {
      deletedCount: result.count,
    };
  }
}

export default new LoginHistoryService();
