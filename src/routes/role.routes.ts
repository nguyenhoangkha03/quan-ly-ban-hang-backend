import { Router } from 'express';
import roleController from '@controllers/role.controller';
import { authentication } from '@middlewares/auth';
import { requireRole } from '@middlewares/authorize';
import { validateNested } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { assignPermissionsSchema, getRoleByIdSchema } from '@validators/role.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/roles - Get all roles
router.get('/', asyncHandler(roleController.getAllRoles.bind(roleController)));

// GET /api/roles/:id - Get role by ID
router.get(
  '/:id',
  validateNested(getRoleByIdSchema),
  asyncHandler(roleController.getRoleById.bind(roleController))
);

// GET /api/roles/:id/permissions - Get role permissions
router.get(
  '/:id/permissions',
  validateNested(getRoleByIdSchema),
  asyncHandler(roleController.getRolePermissions.bind(roleController))
);

// PUT /api/roles/:id/permissions - Assign permissions to role (admin only)
router.put(
  '/:id/permissions',
  requireRole('admin'),
  validateNested(assignPermissionsSchema),
  asyncHandler(roleController.assignPermissions.bind(roleController))
);

// POST /api/roles/:id/permissions/:permissionId - Add single permission (admin only)
router.post(
  '/:id/permissions/:permissionId',
  requireRole('admin'),
  asyncHandler(roleController.addPermission.bind(roleController))
);

// DELETE /api/roles/:id/permissions/:permissionId - Remove single permission (admin only)
router.delete(
  '/:id/permissions/:permissionId',
  requireRole('admin'),
  asyncHandler(roleController.removePermission.bind(roleController))
);

export default router;
