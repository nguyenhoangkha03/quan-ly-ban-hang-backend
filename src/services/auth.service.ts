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
      throw new AuthenticationError('Email hoặc mật khẩu không đúng');
    }

    if (user.status === 'locked') {
      throw new AuthenticationError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên');
    }

    if (user.status === 'inactive') {
      throw new AuthenticationError('Your account is inactive. Please contact administrator');
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(email);
      throw new AuthenticationError('Email hoặc mật khẩu không đúng');
    }

    await this.clearLoginAttempts(email);

    // Create OTP code and send via email
    const { code, expiresIn } = await this.createOTPCode(user.id, user.email, ipAddress);

    // Send OTP via email
    const emailSent = await emailService.sendEmail({
      to: user.email,
      subject: 'Mã xác thực đăng nhập - Công Ty Nam Việt',
      html: this.getOTPEmailTemplate(user.fullName, code),
      text: `Xin chào ${user.fullName},\n\nMã xác thực đăng nhập của bạn là: ${code}\n\nMã này sẽ hết hạn sau 5 phút.\n\nTrân trọng,\nCông Ty Nam Việt`,
    });

    logActivity('login_otp_sent', user.id, 'auth', {
      ipAddress,
      emailSent,
    });

    // Return OTP required response
    return {
      requireOTP: true,
      email: user.email,
      expiresIn,
      // For development only - return code if email not configured
      code: process.env.NODE_ENV === 'development' && !emailSent ? code : undefined,
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
      resetToken: process.env.NODE_ENV === 'development' || !emailSent ? resetToken : undefined,
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

    // Get user permissions
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: user.roleId },
      include: {
        permission: {
          select: {
            permissionKey: true,
          },
        },
      },
    });

    const permissions = rolePermissions.map((rp) => rp.permission.permissionKey);

    const { passwordHash, createdBy, updatedBy, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      permissions,
    };
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

  // Generate 6-digit OTP code
  private generateOTPCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Create and save OTP verification code
  async createOTPCode(
    userId: number,
    email: string,
    ipAddress?: string
  ): Promise<{ code: string; expiresIn: number }> {
    // Delete any existing unused OTP codes for this user
    await prisma.verificationCode.deleteMany({
      where: {
        userId,
        type: 'login_otp',
        isUsed: false,
      },
    });

    const code = this.generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.verificationCode.create({
      data: {
        userId,
        email,
        code,
        type: 'login_otp',
        expiresAt,
        ipAddress,
      },
    });

    return {
      code,
      expiresIn: 5 * 60, // 5 minutes in seconds
    };
  }

  // Verify OTP code and complete login
  async verifyOTPAndLogin(email: string, code: string, ipAddress?: string) {
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
      throw new AuthenticationError('Invalid verification code');
    }

    // Find the OTP code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        email,
        code,
        type: 'login_otp',
        isUsed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verificationCode) {
      throw new AuthenticationError('Invalid verification code');
    }

    // Check if code is expired
    if (new Date() > verificationCode.expiresAt) {
      throw new AuthenticationError('Verification code has expired. Please request a new one');
    }

    // Check max attempts (5 attempts)
    if (verificationCode.attempts >= 5) {
      throw new AuthenticationError('Too many incorrect attempts. Please request a new code');
    }

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        attempts: verificationCode.attempts + 1,
      },
    });

    // Generate tokens
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
      method: '2FA_OTP',
    });

    // Get user permissions
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: user.roleId },
      include: {
        permission: {
          select: {
            permissionKey: true,
          },
        },
      },
    });

    const permissions = rolePermissions.map((rp) => rp.permission.permissionKey);

    // Prepare response
    const { passwordHash, createdBy, updatedBy, ...userWithoutPassword } = user;

    return {
      user: {
        ...userWithoutPassword,
        permissions,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
      },
    };
  }

  // Resend OTP code
  async resendOTPCode(email: string, ipAddress?: string): Promise<{ expiresIn: number }> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
      },
    });

    if (!user || user.status !== 'active') {
      throw new AuthenticationError('Invalid request');
    }

    const { code, expiresIn } = await this.createOTPCode(user.id, user.email, ipAddress);

    // Send OTP via email
    await emailService.sendEmail({
      to: user.email,
      subject: 'Mã xác thực đăng nhập - Công Ty Nam Việt',
      html: this.getOTPEmailTemplate(user.fullName, code),
      text: `Xin chào ${user.fullName},\n\nMã xác thực đăng nhập của bạn là: ${code}\n\nMã này sẽ hết hạn sau 5 phút.\n\nTrân trọng,\nCông Ty Nam Việt`,
    });

    return { expiresIn };
  }

  // OTP Email Template
  private getOTPEmailTemplate(fullName: string, code: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác thực đăng nhập</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Mã Xác Thực Đăng Nhập</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Xin chào <strong>${fullName}</strong>,</p>

    <p style="font-size: 14px; margin-bottom: 20px;">
      Bạn đã yêu cầu đăng nhập vào hệ thống <strong>Quản Lý Bán Hàng - Công Ty Nam Việt</strong>.
    </p>

    <div style="background: white; padding: 25px; border-radius: 10px; text-align: center; margin: 30px 0; border: 2px solid #16a34a;">
      <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Mã xác thực của bạn là:</p>
      <div style="font-size: 36px; font-weight: bold; color: #16a34a; letter-spacing: 8px; font-family: 'Courier New', monospace;">
        ${code}
      </div>
    </div>

    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        ⚠️ <strong>Lưu ý:</strong> Mã này chỉ có hiệu lực trong <strong>5 phút</strong>.
      </p>
    </div>

    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #721c24;">
        🚨 <strong>Bảo mật:</strong> Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; text-align: center;">
      Trân trọng,<br>
      <strong>Công Ty Cổ Phần Hóa Sinh Nam Việt</strong>
    </p>
  </div>
</body>
</html>
    `;
  }
}

export default new AuthService();
