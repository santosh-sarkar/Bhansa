import { Router } from 'express';
import { z } from 'zod';

import {
  createNotificationController,
  listNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  getUnreadCountController,
} from '@/controllers/notification/notification.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

import './notification.docs';

const notificationRouter = Router();

// Validation schemas (inline)
const createNotificationSchema = z.object({
  body: z.object({
    outlet_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    type: z.string().min(1).max(64),
    payload: z.record(z.string(), z.string()).optional(),
  }),
});

const notificationIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    read: z.coerce.boolean().optional(),
    type: z.string().optional(),
  }),
});

// All routes require authentication
notificationRouter.use(authMiddleware);

// Create notification - requires notification.create permission
notificationRouter.post(
  '/notifications',
  requireOrgPermission('notification.create'),
  validate({ body: createNotificationSchema.shape.body }),
  createNotificationController,
);

// List notifications - requires notification.view permission
notificationRouter.get(
  '/notifications',
  requireOrgPermission('notification.view'),
  validate({ query: listNotificationsSchema.shape.query }),
  listNotificationsController,
);

// Get unread count - requires notification.view permission
notificationRouter.get(
  '/notifications/unread-count',
  requireOrgPermission('notification.view'),
  getUnreadCountController,
);

// Mark notification as read - requires notification.view permission
notificationRouter.patch(
  '/notifications/{id}/read',
  requireOrgPermission('notification.view'),
  validate({ params: notificationIdSchema.shape.params }),
  markNotificationReadController,
);

// Mark all notifications as read - requires notification.view permission
notificationRouter.post(
  '/notifications/read-all',
  requireOrgPermission('notification.view'),
  markAllNotificationsReadController,
);

export { notificationRouter };