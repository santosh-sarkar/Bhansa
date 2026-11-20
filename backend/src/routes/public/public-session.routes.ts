import { Router } from 'express';
import { z } from 'zod';

import {
  getCurrentSessionController,
  startTableSessionController,
} from '@/controllers/public/public-session.controller';
import { registry } from '@/docs/openapi';
import { validate } from '@/middlewares/validate';
import { startSessionSchema } from '@/validations/public/public-session.schema';

const publicSessionRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const sessionSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  table_id: z.string().uuid(),
  status: z.string(),
  opened_at: z.string().datetime(),
});

const tableSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  seats: z.number().int().nullable(),
});

const outletSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tax_percent: z.string(),
  service_charge_percent: z.string(),
});

const orderItemSchema = z.object({
  id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int(),
  unit_price: z.string(),
  total_price: z.string(),
  status: z.string(),
});

const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number().int(),
  status: z.string(),
  subtotal: z.string(),
  tax_amount: z.string(),
  discount_amount: z.string(),
  total: z.string(),
  created_at: z.string().datetime(),
  items: z.array(orderItemSchema),
});

const startSessionResponseSchema = z.object({
  session: sessionSchema,
  table: tableSchema,
  outlet: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

const currentSessionResponseSchema = z.object({
  session: sessionSchema,
  table: tableSchema,
  outlet: outletSchema,
  orders: z.array(orderSchema),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/public/sessions',
  tags: ['Public'],
  summary: 'Start or join a table session',
  description:
    'Creates a new table session or joins an existing open session for the table identified by the QR token. ' +
    'Sets a guest token cookie (guest_token) for subsequent requests. ' +
    'If an open session already exists for the table, joins that session instead of creating a new one.',
  request: {
    body: {
      content: {
        'application/json': { schema: startSessionSchema.shape.body },
      },
    },
  },
  responses: {
    201: successResponse('Session started or joined', startSessionResponseSchema),
    400: errorResponse('Validation error'),
    404: errorResponse('Invalid QR token or outlet not available'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/public/sessions/current',
  tags: ['Public'],
  summary: 'Get current session details and orders',
  description:
    'Returns the current session details, table, outlet, and all orders for the session identified by the guest token cookie. ' +
    'Requires the guest_token cookie set by POST /api/v1/public/sessions.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: successResponse('Current session', currentSessionResponseSchema),
    404: errorResponse('No active session'),
  },
});

// Public routes - no authentication required for starting session
publicSessionRouter.post(
  '/sessions',
  validate({ body: startSessionSchema.shape.body }),
  startTableSessionController,
);

// Guest-only route - requires guest token cookie
publicSessionRouter.get('/sessions/current', getCurrentSessionController);

export { publicSessionRouter };
