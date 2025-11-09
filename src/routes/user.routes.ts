import { Router } from 'express';
import userController from '@controllers/user.controller';
import { authentication } from '@middlewares/auth';
import { requireRole } from '@middlewares/authorize';
import { validateNested } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { uploadRateLimiter } from '@middlewares/rateLimiter';
import uploadService from '@services/upload.service';
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  queryUsersSchema,
  getUserByIdSchema,
  deleteUserSchema,
} from '@validators/user.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/users - Get all users (requires permission or admin)
router.get(
  '/',
  validateNested(queryUsersSchema),
  asyncHandler(userController.getAllUsers.bind(userController))
);

// GET /api/users/:id - Get user by ID (authenticated users can view)
router.get(
  '/:id',
  validateNested(getUserByIdSchema),
  asyncHandler(userController.getUserById.bind(userController))
);

// POST /api/users - Create user (admin only)
router.post(
  '/',
  requireRole('admin'),
  validateNested(createUserSchema),
  asyncHandler(userController.createUser.bind(userController))
);

// PUT /api/users/:id - Update user (admin or self)
router.put(
  '/:id',
  validateNested(updateUserSchema),
  asyncHandler(userController.updateUser.bind(userController))
);

// DELETE /api/users/:id - Delete user (admin only)
router.delete(
  '/:id',
  requireRole('admin'),
  validateNested(deleteUserSchema),
  asyncHandler(userController.deleteUser.bind(userController))
);

// PATCH /api/users/:id/status - Update user status (admin only)
router.patch(
  '/:id/status',
  requireRole('admin'),
  validateNested(updateUserStatusSchema),
  asyncHandler(userController.updateUserStatus.bind(userController))
);

// POST /api/users/:id/avatar - Upload avatar (admin or self)
router.post(
  '/:id/avatar',
  uploadRateLimiter, // Rate limit: 20 uploads per hour
  uploadService.getUploadMiddleware().single('avatar'),
  asyncHandler(userController.uploadAvatar.bind(userController))
);

// DELETE /api/users/:id/avatar - Delete avatar (admin or self)
router.delete(
  '/:id/avatar',
  asyncHandler(userController.deleteAvatar.bind(userController))
);

export default router;
