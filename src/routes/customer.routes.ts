import { Router } from 'express';
import customerController from '@controllers/customer.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createCustomerSchema,
  updateCustomerSchema,
  updateCreditLimitSchema,
  updateStatusSchema,
  queryCustomersSchema,
} from '@validators/customer.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/customers/overdue-debt - Get customers with overdue debt (must be before /:id)
router.get(
  '/overdue-debt',
  authorize('view_customer_debt'),
  asyncHandler(customerController.getOverdueDebt.bind(customerController))
);

// GET /api/customers - Get all customers
router.get(
  '/',
  authorize('view_customers'),
  validate(queryCustomersSchema, 'query'),
  asyncHandler(customerController.getAll.bind(customerController))
);

// GET /api/customers/:id - Get customer by ID
router.get(
  '/:id',
  authorize('view_customers'),
  asyncHandler(customerController.getById.bind(customerController))
);

// POST /api/customers - Create new customer
router.post(
  '/',
  authorize('create_customer'),
  validate(createCustomerSchema),
  logActivityMiddleware('create', 'customer'),
  asyncHandler(customerController.create.bind(customerController))
);

// PUT /api/customers/:id - Update customer
router.put(
  '/:id',
  authorize('update_customer'),
  validate(updateCustomerSchema),
  logActivityMiddleware('update', 'customer'),
  asyncHandler(customerController.update.bind(customerController))
);

// PUT /api/customers/:id/credit-limit - Update credit limit
router.put(
  '/:id/credit-limit',
  authorize('update_customer_credit_limit'),
  validate(updateCreditLimitSchema),
  logActivityMiddleware('update_credit_limit', 'customer'),
  asyncHandler(customerController.updateCreditLimit.bind(customerController))
);

// PATCH /api/customers/:id/status - Update status
router.patch(
  '/:id/status',
  authorize('update_customer_status'),
  validate(updateStatusSchema),
  logActivityMiddleware('update_status', 'customer'),
  asyncHandler(customerController.updateStatus.bind(customerController))
);

// GET /api/customers/:id/debt - Get customer debt info
router.get(
  '/:id/debt',
  authorize('view_customer_debt'),
  asyncHandler(customerController.getDebtInfo.bind(customerController))
);

// GET /api/customers/:id/orders - Get customer order history
router.get(
  '/:id/orders',
  authorize('view_customers'),
  asyncHandler(customerController.getOrderHistory.bind(customerController))
);

// DELETE /api/customers/:id - Delete customer
router.delete(
  '/:id',
  authorize('delete_customer'),
  logActivityMiddleware('delete', 'customer'),
  asyncHandler(customerController.delete.bind(customerController))
);

export default router;
