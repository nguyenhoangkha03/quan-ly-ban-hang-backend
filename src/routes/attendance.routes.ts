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
  lockMonthSchema,
} from '@validators/attendance.validator';
import { logActivityMiddleware } from '@middlewares/logger';
import multer from 'multer';

const router = Router();

// Setup multer for file uploads
const upload = multer({
  dest: './uploads/attendance/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    // Only allow Excel files
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authentication);

// GET /api/attendance - Get all attendance records (Admin/Manager)
router.get(
  '/',
  authorize('view_attendance'),
  validate(attendanceQuerySchema, 'query'),
  asyncHandler(attendanceController.getAll.bind(attendanceController))
);

// GET /api/attendance/my - Get my attendance records
router.get(
  '/my',
  validate(attendanceQuerySchema, 'query'),
  asyncHandler(attendanceController.getMyAttendance.bind(attendanceController))
);

// GET /api/attendance/report - Monthly attendance report
router.get(
  '/report',
  authorize('view_attendance'),
  validate(monthlyReportSchema, 'query'),
  asyncHandler(attendanceController.getMonthlyReport.bind(attendanceController))
);

// GET /api/attendance/statistics - User attendance statistics
router.get(
  '/statistics',
  authorize('view_attendance'),
  validate(attendanceQuerySchema, 'query'),
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
  logActivityMiddleware('check in', 'attendance'),
  asyncHandler(attendanceController.checkIn.bind(attendanceController))
);

// POST /api/attendance/check-out - Check out
router.post(
  '/check-out',
  validate(checkOutSchema),
  logActivityMiddleware('check out', 'attendance'),
  asyncHandler(attendanceController.checkOut.bind(attendanceController))
);

// POST /api/attendance/leave - Request leave
router.post(
  '/leave',
  validate(requestLeaveSchema),
  logActivityMiddleware('request leave', 'attendance'),
  asyncHandler(attendanceController.requestLeave.bind(attendanceController))
);

// PUT /api/attendance/:id - Update attendance (Admin)
router.put(
  '/:id',
  authorize('update_attendance'),
  validate(updateAttendanceSchema),
  logActivityMiddleware('update', 'attendance'),
  asyncHandler(attendanceController.update.bind(attendanceController))
);

// PUT /api/attendance/:id/approve - Approve/Reject leave
router.put(
  '/:id/approve',
  authorize('approve_leave'),
  validate(approveLeaveSchema),
  logActivityMiddleware('approve leave', 'attendance'),
  asyncHandler(attendanceController.approveLeave.bind(attendanceController))
);

// POST /api/attendance/lock-month - Lock attendance month
router.post(
  '/lock-month',
  authorize('update_attendance'),
  validate(lockMonthSchema, 'body'),
  logActivityMiddleware('lock month', 'attendance'),
  asyncHandler(attendanceController.lockMonth.bind(attendanceController))
);

// POST /api/attendance/import - Import attendance from file
router.post(
  '/import',
  authorize('update_attendance'),
  upload.single('file'),
  logActivityMiddleware('import', 'attendance'),
  asyncHandler(attendanceController.importFromFile.bind(attendanceController))
);

// DELETE /api/attendance/:id - Delete attendance (Admin)
router.delete(
  '/:id',
  authorize('delete_attendance'),
  logActivityMiddleware('delete', 'attendance'),
  asyncHandler(attendanceController.delete.bind(attendanceController))
);

export default router;
