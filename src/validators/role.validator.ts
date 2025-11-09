import { z } from 'zod';

// Assign permissions to role schema
export const assignPermissionsSchema = z.object({
  body: z
    .object({
      permissionIds: z
        .array(z.number().int().positive('Permission ID must be a positive integer'))
        .min(1, 'At least one permission is required')
        .max(100, 'Maximum 100 permissions allowed'),
    })
    .strict(),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Role ID must be a number'),
  }),
});

// Get role by ID schema
export const getRoleByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Role ID must be a number'),
  }),
});

// Export types
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>['body'];
