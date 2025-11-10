import { z } from 'zod';

export const createSupplierSchema = z.object({
  supplierCode: z
    .string()
    .min(1, 'Supplier code is required')
    .max(50, 'Supplier code too long')
    .regex(/^[A-Z0-9-]+$/, 'Supplier code must be uppercase alphanumeric with hyphens')
    .trim(),
  supplierName: z
    .string()
    .min(1, 'Supplier name is required')
    .max(200, 'Supplier name too long')
    .trim(),
  supplierType: z.enum(['local', 'foreign']).optional().default('local'),
  contactName: z.string().max(100, 'Contact name too long').optional(),
  phone: z
    .string()
    .regex(/^[0-9]{10,11}$/, 'Invalid phone number format')
    .optional(),
  email: z.string().email('Invalid email format').optional(),
  address: z.string().max(255, 'Address too long').optional(),
  taxCode: z
    .string()
    .max(50, 'Tax code too long')
    .regex(/^[0-9-]+$/, 'Tax code must contain only numbers and hyphens')
    .optional(),
  paymentTerms: z.string().max(255, 'Payment terms too long').optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateSupplierSchema = z.object({
  supplierCode: z
    .string()
    .max(50, 'Supplier code too long')
    .regex(/^[A-Z0-9-]+$/, 'Supplier code must be uppercase alphanumeric with hyphens')
    .trim()
    .optional(),
  supplierName: z.string().max(200, 'Supplier name too long').trim().optional(),
  supplierType: z.enum(['local', 'foreign']).optional(),
  contactName: z.string().max(100, 'Contact name too long').nullable().optional(),
  phone: z
    .string()
    .regex(/^[0-9]{10,11}$/, 'Invalid phone number format')
    .nullable()
    .optional(),
  email: z.string().email('Invalid email format').nullable().optional(),
  address: z.string().max(255, 'Address too long').nullable().optional(),
  taxCode: z
    .string()
    .max(50, 'Tax code too long')
    .regex(/^[0-9-]+$/, 'Tax code must contain only numbers and hyphens')
    .nullable()
    .optional(),
  paymentTerms: z.string().max(255, 'Payment terms too long').nullable().optional(),
  notes: z.string().max(500, 'Notes too long').nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const querySuppliersSchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  search: z.string().trim().optional(),
  supplierType: z.enum(['local', 'foreign']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'supplierName', 'supplierCode'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type QuerySuppliersInput = z.infer<typeof querySuppliersSchema>;
