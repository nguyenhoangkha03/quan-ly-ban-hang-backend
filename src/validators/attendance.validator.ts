import { z } from 'zod';

// Attendance Status Enum
export const attendanceStatusEnum = z.enum(['present', 'absent', 'late', 'leave', 'work_from_home']);

export const leaveTypeEnum = z.enum(['none', 'annual', 'sick', 'unpaid', 'other']);

// Query Schema
export const attendanceQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    userId: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: attendanceStatusEnum.optional(),
    leaveType: leaveTypeEnum.optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    month: z.string().regex(/^\d{6}$/).optional(), // YYYYMM format
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>['query'];

// Check-in Schema
export const checkInSchema = z.object({
  body: z.object({
    checkInLocation: z.string().max(255).optional(),
    notes: z.string().max(255).optional(),
  }),
});

export type CheckInInput = z.infer<typeof checkInSchema>['body'];

// Check-out Schema
export const checkOutSchema = z.object({
  body: z.object({
    checkOutLocation: z.string().max(255).optional(),
    notes: z.string().max(255).optional(),
  }),
});

export type CheckOutInput = z.infer<typeof checkOutSchema>['body'];

// Update Attendance Schema (Admin only)
export const updateAttendanceSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    status: attendanceStatusEnum.optional(),
    leaveType: leaveTypeEnum.optional(),
    checkInTime: z.string().optional(), // HH:mm:ss format
    checkOutTime: z.string().optional(), // HH:mm:ss format
    overtimeHours: z.number().min(0).max(24).optional(),
    checkInLocation: z.string().max(255).optional(),
    checkOutLocation: z.string().max(255).optional(),
    notes: z.string().max(255).optional(),
  }),
});

export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>['body'];

// Request Leave Schema
export const requestLeaveSchema = z.object({
  body: z.object({
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date',
    }),
    leaveType: z.enum(['annual', 'sick', 'unpaid', 'other']),
    reason: z.string().min(1, 'Reason is required').max(500),
  }),
});

export type RequestLeaveInput = z.infer<typeof requestLeaveSchema>['body'];

// Approve Leave Schema
export const approveLeaveSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    approved: z.boolean(),
    notes: z.string().max(500).optional(),
  }),
});

// Monthly Report Schema
export const monthlyReportSchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{6}$/, 'Month must be in YYYYMM format'), // YYYYMM
    userId: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});
