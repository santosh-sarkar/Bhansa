import { Router } from 'express';
import { z } from 'zod';

import {
  createNotificationController,
  listNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  getUnreadCountController,
} from '@/controllers/notification/notification.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const notificationRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
});

const paginatedResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: {
    'application/json': {
      schema: z.object({
        success: z.literal(true),
        data: z.array(data),
        pagination: z.object({
          page: z.number().int().positive(),
          limit: z.number().int().positive(),
          total: z.number().int().nonnegative(),
          totalPages: z.number().int().nonnegative(),
        }),
      }),
    },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const notificationDetailSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable(),
  type: z.string(),
  payload: z.record(z.string(), z.string()),
  read_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  outlet: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  user: z.object({ id: z.string().uuid(), full_name: z.string(), email: z.string() }).nullable(),
});

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

registry.registerPath({
  method: 'post',
  path: '/api/v1/notifications',
  tags: ['Notifications'],
  summary: 'Create a notification',
  description: 'Creates a notification for a specific user or outlet. Requires notification.create permission.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            outlet_id: z.string().uuid().optional(),
            user_id: z.string().uuid().optional(),
            type: z.string().min(1).max(64),
            payload: z.record(z.string(), z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: successResponse('Notification created', notificationDetailSchema),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires notification.create permission'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/notifications',
  tags: ['Notifications'],
  summary: 'List notifications',
  description: 'Returns paginated list of notifications for the current user with filters. Requires notification.view permission.',
  security: [{ cookieAuth: [] }],
  request: { query: listNotificationsSchema.shape.query },
  responses: {
    200: paginatedResponse('Notifications list', notificationDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires notification.view permission'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/notifications/unread-count',
  tags: ['Notifications'],
  summary: 'Get unread notification count',
  description: 'Returns the count of unread notifications for the current user. Requires notification.view permission.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: successResponse('Unread count', z.object({ count: z.number().int().nonnegative() })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires notification.view permission'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/notifications/{id}/read',
  tags: ['Notifications'],
  summary: 'Mark notification as read',
  description: 'Marks a single notification as read. Requires notification.view permission.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Notification marked as read', notificationDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or not your notification'),
    404: errorResponse('Notification not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/notifications/read-all',
  tags: ['Notifications'],
  summary: 'Mark all notifications as read',
  description: 'Marks all unread notifications as read for the current user. Requires notification.view permission.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: successResponse('All notifications marked as read', z.object({ count: z.number().int().nonnegative() })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires notification.view permission'),
  },
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