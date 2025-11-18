import { Router } from 'express';
import securityController from '@controllers/security.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';

/**
 * Security Routes
 *
 * Handles security-related endpoints
 */

const router = Router();

/**
 * @swagger
 * /api/security/csrf-token:
 *   get:
 *     summary: Get CSRF token
 *     tags: [Security]
 *     responses:
 *       200:
 *         description: CSRF token generated successfully
 */
router.get('/csrf-token', securityController.getCsrfToken);

/**
 * @swagger
 * /api/security/status:
 *   get:
 *     summary: Get security status for current user
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security status retrieved successfully
 */
router.get('/status', authentication, securityController.getSecurityStatus);

/**
 * @swagger
 * /api/security/revoke-all-sessions:
 *   post:
 *     summary: Revoke all sessions (logout from all devices)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked successfully
 */
router.post('/revoke-all-sessions', authentication, securityController.revokeAllSessions);

/**
 * @swagger
 * /api/security/audit-log:
 *   get:
 *     summary: Get security audit log
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 */
router.get('/audit-log', authentication, securityController.getAuditLog);

/**
 * @swagger
 * /api/security/headers:
 *   get:
 *     summary: Get security headers information
 *     tags: [Security]
 *     responses:
 *       200:
 *         description: Security headers info retrieved
 */
router.get('/headers', securityController.getSecurityHeaders);

/**
 * @swagger
 * /api/security/generate-encryption-key:
 *   get:
 *     summary: Generate new encryption key (Admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Encryption key generated
 */
router.get(
  '/generate-encryption-key',
  authentication,
  authorize('manage_settings'),
  securityController.generateEncryptionKey
);

export default router;
