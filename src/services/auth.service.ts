import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '@utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@utils/jwt';
import { AuthenticationError, NotFoundError, ValidationError } from '@utils/errors';
import RedisService, { CachePrefix } from './redis.service';
import { JwtPayload } from '@custom-types/index';
import { logActivity } from '@utils/logger';
import emailService from './email.service';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

// Constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_TIME = 15 * 60;

class AuthService {
  // Login user
  async login(email: string, password: string, ipAddress?: string) {
    const loginAttempts = await this.getLoginAttempts(email);
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockTime = await redis.ttl(`${CachePrefix.RATE_LIMIT}login:${email}`);
      const minutesLeft = Math.ceil(lockTime / 60);
      throw new AuthenticationError(
        `Account locked due to too many failed login attempts. Try again in ${minutesLeft} minutes`
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
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

    if (!user) {
      await this.incrementLoginAttempts(email);
      throw new AuthenticationError('Invalid email or password');
    }

    if (user.status === 'locked') {
      throw new AuthenticationError('Your account has been locked. Please contact administrator');
    }

    if (user.status === 'inactive') {
      throw new AuthenticationError('Your account is inactive. Please contact administrator');
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(email);
      throw new AuthenticationError('Invalid email or password');
    }

    await this.clearLoginAttempts(email);

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      warehouseId: user.warehouseId || undefined,
      employeeCode: user.employeeCode,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const refreshTokenTTL = 7 * 24 * 60 * 60; // 7 days in seconds
    await redis.set(`${CachePrefix.SESSION}refresh:${user.id}`, refreshToken, refreshTokenTTL);

    await this.updateLastLogin(user.id);

    logActivity('login', user.id, 'auth', {
      ipAddress,
      userAgent: 'unknown',
    });

    // Prepare response
    const { passwordHash, createdBy, updatedBy, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
      },
    };
  }

  // Logout user
  async logout(userId: number, accessToken: string) {
    const tokenTTL = 15 * 60;
    await redis.set(`${CachePrefix.BLACKLIST}${accessToken}`, 'true', tokenTTL);

    await redis.del(`${CachePrefix.SESSION}refresh:${userId}`);

    logActivity('logout', userId, 'auth');

    return { message: 'Logged out successfully' };
  }

  // Refresh access token
  async refreshToken(refreshToken: string) {
    const decoded = verifyRefreshToken(refreshToken);

    const storedToken = await redis.get(`${CachePrefix.SESSION}refresh:${decoded.id}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new AuthenticationError('Invalid refresh token');
    }

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
      throw new NotFoundError('User not found');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('User account is not active');
    }

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      warehouseId: user.warehouseId || undefined,
      employeeCode: user.employeeCode,
    };

    const newAccessToken = generateAccessToken(payload);

    return {
      accessToken: newAccessToken,
      expiresIn: 15 * 60,
    };
  }

  // Change password
  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isOldPasswordValid = await comparePassword(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new ValidationError('Current password is incorrect');
    }

    const isSamePassword = await comparePassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new ValidationError('New password must be different from current password');
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    logActivity('update', userId, 'users', {
      recordId: userId,
      action: 'change_password',
    });

    await redis.del(`${CachePrefix.SESSION}refresh:${userId}`);

    // Send notification email
    await emailService.sendPasswordChangedEmail(user.email, user.fullName);

    return { message: 'Password changed successfully. Please login again' };
  }

  // Forgot password - Send reset token
  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
      },
    });

    if (!user) {
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    if (user.status !== 'active') {
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    const resetToken = this.generateResetToken();
    const resetTokenTTL = 60 * 60;

    await redis.set(`${CachePrefix.SESSION}reset:${resetToken}`, user.id.toString(), resetTokenTTL);

    // Send email with reset link
    const emailSent = await emailService.sendPasswordResetEmail(
      user.email,
      user.fullName,
      resetToken
    );

    // Log activity
    logActivity('forgot_password', user.id, 'auth', {
      email: user.email,
      emailSent,
    });

    return {
      message: 'If the email exists, a password reset link has been sent',
      // For development only - return token if email not configured or in dev mode
      resetToken:
        process.env.NODE_ENV === 'development' || !emailSent ? resetToken : undefined,
    };
  }

  // Reset password with token
  async resetPassword(token: string, newPassword: string) {
    const userIdStr = await redis.get(`${CachePrefix.SESSION}reset:${token}`);
    if (!userIdStr) {
      throw new AuthenticationError('Invalid or expired reset token');
    }

    const userId = parseInt(userIdStr);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    await redis.del(`${CachePrefix.SESSION}reset:${token}`);

    await redis.del(`${CachePrefix.SESSION}refresh:${userId}`);

    logActivity('update', userId, 'users', {
      recordId: userId,
      action: 'reset_password',
    });

    return { message: 'Password reset successfully. Please login with your new password' };
  }

  // Get current user details
  async getCurrentUser(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
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

    const { passwordHash, createdBy, updatedBy, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  // Helper methods
  // Update last login timestamp
  private async updateLastLogin(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }

  // Get login attempts count
  private async getLoginAttempts(email: string): Promise<number> {
    const key = `${CachePrefix.RATE_LIMIT}login:${email}`;
    const attempts = await redis.get(key);
    return attempts ? parseInt(attempts) : 0;
  }

  // Increment login attempts
  private async incrementLoginAttempts(email: string) {
    const key = `${CachePrefix.RATE_LIMIT}login:${email}`;
    const attempts = await redis.incr(key);

    if (attempts === 1) {
      await redis.expire(key, LOGIN_LOCK_TIME);
    }
  }

  // Clear login attempts
  private async clearLoginAttempts(email: string) {
    const key = `${CachePrefix.RATE_LIMIT}login:${email}`;
    await redis.del(key);
  }

  // Generate reset token
  private generateResetToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}

export default new AuthService();
