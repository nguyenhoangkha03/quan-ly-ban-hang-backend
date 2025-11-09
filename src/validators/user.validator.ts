import { z } from 'zod';

// Enum validation
const genderEnum = z.enum(['male', 'female', 'other']);
const userStatusEnum = z.enum(['active', 'inactive', 'locked']);

// Base user fields for creation
export const createUserSchema = z.object({
  body: z
    .object({
      employeeCode: z
        .string()
        .min(3, 'Employee code must be at least 3 characters')
        .max(50, 'Employee code must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Employee code must contain only letters, numbers, hyphens and underscores'),
      email: z.string().email('Invalid email format'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(
          /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
          'Password must contain at least one special character'
        ),
      fullName: z
        .string()
        .min(2, 'Full name must be at least 2 characters')
        .max(200, 'Full name must not exceed 200 characters'),
      phone: z
        .string()
        .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
        .max(20, 'Phone number must not exceed 20 characters')
        .optional(),
      address: z.string().max(255, 'Address must not exceed 255 characters').optional(),
      gender: genderEnum.optional(),
      dateOfBirth: z
        .string()
        .refine((date) => {
          const parsedDate = new Date(date);
          const today = new Date();
          return parsedDate < today;
        }, 'Date of birth must be in the past')
        .optional(),
      roleId: z.number().int().positive('Role ID must be a positive integer'),
      warehouseId: z.number().int().positive('Warehouse ID must be a positive integer').optional(),
      status: userStatusEnum.optional().default('active'),
    })
    .strict(),
});

// Update user schema (all fields optional except restrictions)
export const updateUserSchema = z.object({
  body: z
    .object({
      employeeCode: z
        .string()
        .min(3, 'Employee code must be at least 3 characters')
        .max(50, 'Employee code must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Employee code must contain only letters, numbers, hyphens and underscores')
        .optional(),
      email: z.string().email('Invalid email format').optional(),
      fullName: z
        .string()
        .min(2, 'Full name must be at least 2 characters')
        .max(200, 'Full name must not exceed 200 characters')
        .optional(),
      phone: z
        .string()
        .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
        .max(20, 'Phone number must not exceed 20 characters')
        .optional()
        .nullable(),
      address: z.string().max(255, 'Address must not exceed 255 characters').optional().nullable(),
      gender: genderEnum.optional().nullable(),
      dateOfBirth: z
        .string()
        .refine((date) => {
          const parsedDate = new Date(date);
          const today = new Date();
          return parsedDate < today;
        }, 'Date of birth must be in the past')
        .optional()
        .nullable(),
      roleId: z.number().int().positive('Role ID must be a positive integer').optional(),
      warehouseId: z.number().int().positive('Warehouse ID must be a positive integer').optional().nullable(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
});

// Update user status schema
export const updateUserStatusSchema = z.object({
  body: z
    .object({
      status: userStatusEnum,
      reason: z.string().min(10, 'Reason must be at least 10 characters').max(500).optional(),
    })
    .strict(),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
});

// Query/filter users schema
export const queryUsersSchema = z.object({
  query: z
    .object({
      page: z.string().regex(/^\d+$/).optional().default('1'),
      limit: z
        .string()
        .regex(/^\d+$/)
        .optional()
        .default('20')
        .refine((val) => parseInt(val) <= 100, {
          message: 'Limit must not exceed 100',
        }),
      search: z.string().max(200).optional(),
      roleId: z.string().regex(/^\d+$/).optional(),
      warehouseId: z.string().regex(/^\d+$/).optional(),
      status: userStatusEnum.optional(),
      gender: genderEnum.optional(),
      sortBy: z
        .enum(['createdAt', 'updatedAt', 'fullName', 'email', 'employeeCode', 'lastLogin'])
        .optional()
        .default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    })
    .strict(),
});

// Get user by ID schema
export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
});

// Delete user schema
export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
});

// Export types
export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>['body'];
export type QueryUsersInput = z.infer<typeof queryUsersSchema>['query'];
