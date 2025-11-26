import { z } from 'zod';

// Login schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z.string().min(1, 'Password is required'),
});

// Change password schema
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
    .regex(/\d/, 'Password must contain at least 1 number')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      'Password must contain at least 1 special character'
    ),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
    .regex(/\d/, 'Password must contain at least 1 number')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      'Password must contain at least 1 special character'
    ),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Register schema (for creating new user)
export const registerSchema = z.object({
  employeeCode: z
    .string()
    .min(1, 'Employee code is required')
    .regex(/^[A-Z0-9]+$/, 'Employee code must be alphanumeric uppercase')
    .trim(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
    .regex(/\d/, 'Password must contain at least 1 number')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      'Password must contain at least 1 special character'
    ),
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(200, 'Full name too long')
    .trim(),
  phone: z
    .string()
    .regex(/^[0-9]{10,11}$/, 'Invalid phone number format')
    .optional(),
  roleId: z.number().int().positive('Invalid role ID'),
  warehouseId: z.number().int().positive('Invalid warehouse ID').optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().datetime().or(z.date()).optional(),
  address: z.string().max(255, 'Address too long').optional(),
});

// Verify OTP schema
export const verifyOTPSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  code: z
    .string()
    .length(6, 'OTP code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP code must contain only numbers'),
});

// Resend OTP schema
export const resendOTPSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
});

// Types
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>;
export type ResendOTPInput = z.infer<typeof resendOTPSchema>;
