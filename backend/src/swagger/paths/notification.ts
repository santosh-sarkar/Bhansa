import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const payloadSchema = z.record(z.string(), z.string()).openapi({
  type: 'object',
  additionalProperties: { type: 'string' },
  description: 'Key-value payload data',
});

const notificationDetailSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable(),
  type: z.string(),
  payload: payloadSchema,
  read_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  outlet: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  user: z.object({ id: z.string().uuid(), full_name: z.string(), email: z.string() }).nullable(),
});

const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    read: z.coerce.boolean().optional(),
    type: z.string().optional(),
  }),
});

const createNotificationSchema = z.object({
  body: z.object({
    outlet_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    type: z.string().min(1).max(64),
    payload: payloadSchema.optional(),
  }),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/notifications',
  tags: ['Notifications'],
  summary: 'Create a notification',
  description: 'Creates a notification for a specific user or outlet. Requires notification.create permission.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createNotificationSchema.shape.body,
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
  security: [{ bearerAuth: [] }],
  request: { query: listNotificationsSchema.shape.query },
  responses: {
    200: {
      description: 'Notifications list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(notificationDetailSchema),
        },
      },
    },
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
  responses: {
    200: successResponse('All notifications marked as read', z.object({ count: z.number().int().nonnegative() })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires notification.view permission'),
  },
});
