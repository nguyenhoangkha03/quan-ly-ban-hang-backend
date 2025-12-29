import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import authService from '@services/auth.service';
import { ApiResponse } from '@custom-types/common.type';
import { AuthenticationError } from '@utils/errors';

class AuthController {
  // POST /api/auth/login
  async login(req: AuthRequest, res: Response) {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await authService.login(email, password, ipAddress);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/auth/logout
  async logout(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const token = req.headers.authorization?.substring(7) || '';

    const result = await authService.logout(userId, token);

    // Clear refreshToken cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/auth/refresh-token
  async refreshToken(req: AuthRequest, res: Response) {
    // Get refreshToken from Cookie (NOT from body)
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh Token không tìm thấy');
    }

    const result = await authService.refreshToken(refreshToken);

    // Return new Access Token
    const response: ApiResponse = {
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: 15 * 60, // 15 minutes
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // PUT /api/auth/change-password
  async changePassword(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { oldPassword, newPassword } = req.body;

    const result = await authService.changePassword(userId, oldPassword, newPassword);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/auth/forgot-password
  async forgotPassword(req: AuthRequest, res: Response) {
    const { email } = req.body;

    const result = await authService.forgotPassword(email);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  //POST /api/auth/reset-password
  async resetPassword(req: AuthRequest, res: Response) {
    const { token, newPassword } = req.body;

    const result = await authService.resetPassword(token, newPassword);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/auth/me
  async getMe(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const user = await authService.getCurrentUser(userId);

    const response: ApiResponse = {
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/auth/verify-otp
  async verifyOTP(req: AuthRequest, res: Response) {
    const { email, code } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await authService.verifyOTPAndLogin(email, code, ipAddress);

    // Set Refresh Token vào HttpOnly Cookie (Backend manages it)
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true, // JS không đọc được
      secure: process.env.NODE_ENV === 'production', // HTTPS only khi production
      sameSite: 'strict', // Chống CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Return Response (WITHOUT refreshToken in JSON)
    const response: ApiResponse = {
      success: true,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken, // Only accessToken
          expiresIn: result.tokens.expiresIn,
        },
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/auth/resend-otp
  async resendOTP(req: AuthRequest, res: Response) {
    const { email } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await authService.resendOTPCode(email, ipAddress);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new AuthController();
