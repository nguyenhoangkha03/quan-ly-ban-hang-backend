import { Response } from 'express';
import { AuthRequest, ApiResponse, ApiErrorResponse, ErrorCode } from '@custom-types/index';
import notificationService from '@services/notification.service';

class NotificationController {
  // GET /api/notifications
  async getAll(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const {
      isRead,
      notificationType,
      priority,
      page = '1',
      limit = '20',
    } = req.query;

    const result = await notificationService.getByUserId(userId, {
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
      notificationType: notificationType as any,
      priority: priority as any,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    const response: ApiResponse = {
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/notifications/unread
  async getUnread(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const notifications = await notificationService.getByUserId(userId, {
      isRead: false,
      page: 1,
      limit: 50,
    });

    const response: ApiResponse = {
      success: true,
      data: notifications.data,
      meta: notifications.meta,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/notifications/unread-count
  async getUnreadCount(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);

    const response: ApiResponse = {
      success: true,
      data: { count },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/notifications/:id
  async getById(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const id = BigInt(req.params.id);

    const notification = await notificationService.getById(id, userId);

    const response: ApiResponse = {
      success: true,
      data: notification,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/notifications
  async create(req: AuthRequest, res: Response) {
    const senderId = req.user!.id;
    const data = {
      ...req.body,
      senderId,
    };

    const notification = await notificationService.create(data);

    const response: ApiResponse = {
      success: true,
      data: notification,
      message: 'Notification created successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // POST /api/notifications/broadcast
  async broadcast(req: AuthRequest, res: Response): Promise<any> {
    const { userIds, roleId, title, message, notificationType, priority, channel } = req.body;

    let result;

    if (roleId) {
      // Send to all users with specific role
      result = await notificationService.sendToRole(roleId, {
        title,
        message,
        notificationType,
        priority,
        channel,
      });
    } else if (userIds && userIds.length > 0) {
      // Send to specific users
      result = await notificationService.sendToUsers({
        userIds,
        title,
        message,
        notificationType,
        priority,
        channel,
      });
    } else {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Either userIds or roleId is required',
          timestamp: new Date().toISOString(),
        },
      };
      return res.status(400).json(errorResponse);
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      message: `Notification sent to ${result.length} users`,
      timestamp: new Date().toISOString(),
    };

    return res.status(201).json(response);
  }

  // PUT /api/notifications/:id/read
  async markAsRead(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const id = BigInt(req.params.id);

    const notification = await notificationService.markAsRead(id, userId);

    const response: ApiResponse = {
      success: true,
      data: notification,
      message: 'Notification marked as read',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // PUT /api/notifications/read-all
  async markAllAsRead(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const result = await notificationService.markAllAsRead(userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // DELETE /api/notifications/:id
  async delete(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const id = BigInt(req.params.id);

    const result = await notificationService.delete(id, userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // DELETE /api/notifications/read
  async deleteAllRead(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const result = await notificationService.deleteAllRead(userId);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/notifications/cleanup/expired
  async cleanupExpired(_req: AuthRequest, res: Response) {
    const result = await notificationService.cleanupExpired();

    const response: ApiResponse = {
      success: true,
      data: result,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/notifications/cleanup/deleted
  async cleanupDeleted(_req: AuthRequest, res: Response) {
    const result = await notificationService.cleanupDeleted();

    const response: ApiResponse = {
      success: true,
      data: result,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new NotificationController();
