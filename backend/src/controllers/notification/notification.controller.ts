import type { RequestHandler } from 'express';

import {
  createNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from '@/services/notification/notification.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const createNotificationController: RequestHandler = async (req, res, next) => {
  try {
    const { outlet_id, user_id, type, payload } = req.body as {
      outlet_id?: string;
      user_id?: string;
      type: string;
      payload?: Record<string, string>;
    };

    if (!type) {
      return next(new AppError('VALIDATION_ERROR', 'type is required', 400));
    }

    const notification = await createNotification({ outlet_id, user_id, type, payload });

    sendSuccess(res, notification, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const listNotificationsController: RequestHandler = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, read, type } = req.query as {
      page?: string;
      limit?: string;
      read?: string;
      type?: string;
    };

    const result = await listNotifications(req.user!, {
      page: Number(page),
      limit: Number(limit),
      read: read === 'true' ? true : read === 'false' ? false : undefined,
      type,
    });

    sendPaginated(res, result.notifications, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationReadController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const notification = await markNotificationRead(req.user!, id);

    sendSuccess(res, notification);
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsReadController: RequestHandler = async (req, res, next) => {
  try {
    const result = await markAllNotificationsRead(req.user!);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const getUnreadCountController: RequestHandler = async (req, res, next) => {
  try {
    const result = await getUnreadCount(req.user!);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

import { AppError } from '@/errors/AppError';