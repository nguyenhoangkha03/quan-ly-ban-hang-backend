import { Router } from 'express';
import attendanceController from '@controllers/attendance.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  attendanceQuerySchema,
  checkInSchema,
  checkOutSchema,
  updateAttendanceSchema,
  requestLeaveSchema,
  approveLeaveSchema,
  monthlyReportSchema,
} from '@validators/attendance.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/attendance - Get all attendance records (Admin/Manager)
router.get(
  '/',
  authorize('view_attendance'),
  validate(attendanceQuerySchema),
  asyncHandler(attendanceController.getAll.bind(attendanceController))
);

// GET /api/attendance/my - Get my attendance records
router.get(
  '/my',
  validate(attendanceQuerySchema),
  asyncHandler(attendanceController.getMyAttendance.bind(attendanceController))
);

// GET /api/attendance/report - Monthly attendance report
router.get(
  '/report',
  authorize('view_attendance'),
  validate(monthlyReportSchema),
  asyncHandler(attendanceController.getMonthlyReport.bind(attendanceController))
);

// GET /api/attendance/statistics - User attendance statistics
router.get(
  '/statistics',
  authorize('view_attendance'),
  asyncHandler(attendanceController.getUserStatistics.bind(attendanceController))
);

// GET /api/attendance/:id - Get attendance by ID
router.get(
  '/:id',
  authorize('view_attendance'),
  asyncHandler(attendanceController.getById.bind(attendanceController))
);

// POST /api/attendance/check-in - Check in
router.post(
  '/check-in',
  validate(checkInSchema),
  asyncHandler(attendanceController.checkIn.bind(attendanceController))
);

// POST /api/attendance/check-out - Check out
router.post(
  '/check-out',
  validate(checkOutSchema),
  asyncHandler(attendanceController.checkOut.bind(attendanceController))
);

// POST /api/attendance/leave - Request leave
router.post(
  '/leave',
  validate(requestLeaveSchema),
  asyncHandler(attendanceController.requestLeave.bind(attendanceController))
);

// PUT /api/attendance/:id - Update attendance (Admin)
router.put(
  '/:id',
  authorize('update_attendance'),
  validate(updateAttendanceSchema),
  asyncHandler(attendanceController.update.bind(attendanceController))
);

// PUT /api/attendance/:id/approve - Approve/Reject leave
router.put(
  '/:id/approve',
  authorize('approve_leave'),
  validate(approveLeaveSchema),
  asyncHandler(attendanceController.approveLeave.bind(attendanceController))
);

// DELETE /api/attendance/:id - Delete attendance (Admin)
router.delete(
  '/:id',
  authorize('delete_attendance'),
  asyncHandler(attendanceController.delete.bind(attendanceController))
);

export default router;
