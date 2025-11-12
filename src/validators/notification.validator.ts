import { z } from 'zod';

// Notification types enum
export const NotificationTypeEnum = z.enum([
  'system',
  'low_stock',
  'expiry_warning',
  'debt_overdue',
  'order_new',
  'approval_required',
  'reminder',
  'announcement',
]);

// Notification priority enum
export const NotificationPriorityEnum = z.enum(['low', 'normal', 'high']);

// Notification channel enum
export const NotificationChannelEnum = z.enum(['web', 'email', 'sms', 'mobile_app', 'all']);

// Create notification schema
export const createNotificationSchema = z.object({
  body: z.object({
    userId: z.number().int().positive('User ID must be a positive integer'),
    title: z
      .string()
      .min(1, 'Title is required')
      .max(200, 'Title must not exceed 200 characters'),
    message: z
      .string()
      .min(1, 'Message is required')
      .max(500, 'Message must not exceed 500 characters'),
    notificationType: NotificationTypeEnum.optional(),
    priority: NotificationPriorityEnum.optional(),
    channel: NotificationChannelEnum.optional(),
    referenceType: z.string().max(50).optional(),
    referenceId: z.number().int().positive().optional(),
    metaData: z.any().optional(),
    expiresAt: z.string().datetime().optional(),
  }),
});

// Broadcast notification schema
export const broadcastNotificationSchema = z.object({
  body: z
    .object({
      userIds: z.array(z.number().int().positive()).optional(),
      roleId: z.number().int().positive().optional(),
      title: z
        .string()
        .min(1, 'Title is required')
        .max(200, 'Title must not exceed 200 characters'),
      message: z
        .string()
        .min(1, 'Message is required')
        .max(500, 'Message must not exceed 500 characters'),
      notificationType: NotificationTypeEnum.optional(),
      priority: NotificationPriorityEnum.optional(),
      channel: NotificationChannelEnum.optional(),
      referenceType: z.string().max(50).optional(),
      referenceId: z.number().int().positive().optional(),
      metaData: z.any().optional(),
    })
    .refine((data) => data.userIds || data.roleId, {
      message: 'Either userIds or roleId must be provided',
    }),
});

// Get notifications query schema
export const getNotificationsQuerySchema = z.object({
  query: z.object({
    isRead: z.enum(['true', 'false']).optional(),
    notificationType: NotificationTypeEnum.optional(),
    priority: NotificationPriorityEnum.optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

// Notification ID param schema
export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid notification ID'),
  }),
});
