import { Router } from 'express';
import permissionController from '@controllers/permission.controller';
import { authentication } from '@middlewares/auth';
import { asyncHandler } from '@middlewares/errorHandler';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/permissions - Get all permissions (grouped by module)
router.get('/', asyncHandler(permissionController.getAllPermissions.bind(permissionController)));

// GET /api/permissions/module/:module - Get permissions by module
router.get(
  '/module/:module',
  asyncHandler(permissionController.getPermissionsByModule.bind(permissionController))
);

export default router;
