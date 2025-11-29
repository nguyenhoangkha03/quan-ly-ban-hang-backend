import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import attendanceService from '@services/attendance.service';
import {
  AttendanceQueryInput,
  CheckInInput,
  CheckOutInput,
  UpdateAttendanceInput,
  RequestLeaveInput,
} from '@validators/attendance.validator';

class AttendanceController {
  // GET /api/attendance - Get all attendance records
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const query = req.query as unknown as AttendanceQueryInput;
      const result = await attendanceService.getAll(query);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // GET /api/attendance/:id - Get attendance by ID
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const attendance = await attendanceService.getById(id);

      res.json({
        success: true,
        data: attendance,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // GET /api/attendance/my - Get my attendance records
  async getMyAttendance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const query = req.query as unknown as AttendanceQueryInput;
      const result = await attendanceService.getMyAttendance(userId, query);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // POST /api/attendance/check-in - Check in
  async checkIn(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body as CheckInInput;

      const attendance = await attendanceService.checkIn(userId, data);

      res.status(201).json({
        success: true,
        data: attendance,
        message: 'Checked in successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // POST /api/attendance/check-out - Check out
  async checkOut(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body as CheckOutInput;

      const result = await attendanceService.checkOut(userId, data);

      res.json({
        success: true,
        data: result,
        message: 'Checked out successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // PUT /api/attendance/:id - Update attendance (Admin)
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const data = req.body as UpdateAttendanceInput;
      const adminId = req.user!.id;

      const attendance = await attendanceService.update(id, data, adminId);

      res.json({
        success: true,
        data: attendance,
        message: 'Attendance updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // POST /api/attendance/leave - Request leave
  async requestLeave(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body as RequestLeaveInput;

      const attendance = await attendanceService.requestLeave(userId, data);

      res.status(201).json({
        success: true,
        data: attendance,
        message: 'Leave request submitted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // PUT /api/attendance/:id/approve - Approve/Reject leave
  async approveLeave(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { approved, notes } = req.body;
      const approverId = req.user!.id;

      const attendance = await attendanceService.approveLeave(id, approved, approverId, notes);

      res.json({
        success: true,
        data: attendance,
        message: approved ? 'Leave approved successfully' : 'Leave rejected',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // GET /api/attendance/report - Monthly report
  async getMonthlyReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { month, userId } = req.query;
      const report = await attendanceService.getMonthlyReport(
        month as string,
        userId ? parseInt(userId as string) : undefined
      );

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // GET /api/attendance/statistics - Get user statistics
  async getUserStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId, fromDate, toDate } = req.query;

      if (!fromDate || !toDate) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'fromDate and toDate are required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const stats = await attendanceService.getUserStatistics(
        userId ? parseInt(userId as string) : req.user!.id,
        new Date(fromDate as string),
        new Date(toDate as string)
      );

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // DELETE /api/attendance/:id - Delete attendance
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const adminId = req.user!.id;

      const result = await attendanceService.delete(id, adminId);

      res.json({
        success: true,
        data: result,
        message: 'Attendance deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}

export default new AttendanceController();
