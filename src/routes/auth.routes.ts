import { Router } from 'express';
import authController from '@controllers/auth.controller';
import { authentication } from '@middlewares/auth';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { loginRateLimiter, createRateLimiter } from '@middlewares/rateLimiter';
import {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@validators/auth.validator';

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  loginRateLimiter, // 5 attempts per 15 minutes
  validate(loginSchema),
  asyncHandler(authController.login.bind(authController))
);

// POST /api/auth/logout
router.post('/logout', authentication, asyncHandler(authController.logout.bind(authController)));

// POST /api/auth/refresh-token
router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  asyncHandler(authController.refreshToken.bind(authController))
);

// PUT /api/auth/change-password
router.put(
  '/change-password',
  authentication,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword.bind(authController))
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: 'Too many password reset requests',
  }),
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword.bind(authController))
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword.bind(authController))
);

// GET /api/auth/me
router.get('/me', authentication, asyncHandler(authController.getMe.bind(authController)));

export default router;
