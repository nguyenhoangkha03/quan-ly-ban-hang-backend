import { z } from 'zod';

export const createCustomerSchema = z.object({
  body: z.object({
    customerCode: z.string().min(1).max(50, 'Customer code must be at most 50 characters'),
    customerName: z.string().min(1).max(200, 'Customer name must be at most 200 characters'),
    customerType: z.enum(['individual', 'company']),
    classification: z.enum(['retail', 'wholesale', 'vip', 'distributor']).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    contactPerson: z.string().max(100).optional(),
    phone: z
      .string()
      .min(10, 'Phone must be at least 10 characters')
      .max(20, 'Phone must be at most 20 characters')
      .regex(/^[0-9+\-\s()]+$/, 'Invalid phone format'),
    email: z.string().email('Invalid email format').max(100).optional().or(z.literal('')),
    address: z.string().max(255).optional(),
    province: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    taxCode: z.string().max(50).optional(),
    creditLimit: z.number().min(0, 'Credit limit must be non-negative').optional(),
    notes: z.string().max(255).optional(),
  }),
});

export const updateCustomerSchema = z.object({
  body: z.object({
    customerName: z.string().min(1).max(200).optional(),
    customerType: z.enum(['individual', 'company']).optional(),
    classification: z.enum(['retail', 'wholesale', 'vip', 'distributor']).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    contactPerson: z.string().max(100).optional(),
    phone: z
      .string()
      .min(10)
      .max(20)
      .regex(/^[0-9+\-\s()]+$/, 'Invalid phone format')
      .optional(),
    email: z.string().email().max(100).optional().or(z.literal('')),
    address: z.string().max(255).optional(),
    province: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    taxCode: z.string().max(50).optional(),
    creditLimit: z.number().min(0).optional(),
    notes: z.string().max(255).optional(),
  }),
});

export const updateCreditLimitSchema = z.object({
  body: z.object({
    creditLimit: z.number().min(0, 'Credit limit must be non-negative'),
    reason: z.string().min(10, 'Reason must be at least 10 characters').max(255),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'inactive', 'blacklisted']),
    reason: z.string().min(10, 'Reason must be at least 10 characters').max(255).optional(),
  }),
});

export const customerQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    customerType: z.enum(['individual', 'company']).optional(),
    classification: z.enum(['retail', 'wholesale', 'vip', 'distributor']).optional(),
    status: z.enum(['active', 'inactive', 'blacklisted']).optional(),
    province: z.string().optional(),
    district: z.string().optional(),
    hasOverdueDebt: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>['body'];
export type UpdateCreditLimitInput = z.infer<typeof updateCreditLimitSchema>['body'];
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>['body'];
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>['query'];
