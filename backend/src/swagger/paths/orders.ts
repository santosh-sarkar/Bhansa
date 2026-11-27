import { z } from 'zod';

import { registry } from '@/swagger';
import { listOrdersSchema } from '@/validations/order/order.schema';
import { createStaffOrderSchema } from '@/validations/order/order.schema';
import { orderIdSchema } from '@/validations/order/order.schema';
import { rejectOrderSchema } from '@/validations/order/order.schema';
import { sessionIdSchema } from '@/validations/order/order.schema';
import { updateOrderItemStatusSchema } from '@/validations/order/order.schema';
import { updateOrderStatusSchema } from '@/validations/order/order.schema';
import { cancelOrderSchema } from '@/validations/order/order.schema';
import { kitchenBoardSchema } from '@/validations/order/order.schema';
import { listSessionsSchema } from '@/validations/order/order.schema';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const paginatedResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: {
    'application/json': {
      schema: paginatedResponseSchema(data),
    },
  },
});

const orderListItemSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number().int(),
  order_type: z.string(),
  status: z.string(),
  table_id: z.string().uuid().nullable(),
  table_label: z.string().nullable(),
  session_id: z.string().uuid().nullable(),
  subtotal: z.string(),
  tax_amount: z.string(),
  discount_amount: z.string(),
  total: z.string(),
  created_at: z.string().datetime(),
  confirmed_at: z.string().datetime().nullable(),
  items_count: z.number().int(),
});

const orderDetailSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number().int(),
  order_type: z.string(),
  status: z.string(),
  table_id: z.string().uuid().nullable(),
  table_label: z.string().nullable(),
  session_id: z.string().uuid().nullable(),
  outlet_id: z.string().uuid(),
  outlet_name: z.string(),
  customer_name: z.string().nullable(),
  customer_phone: z.string().nullable(),
  notes: z.string().nullable(),
  tax_percent: z.string(),
  service_charge_percent: z.string(),
  subtotal: z.string(),
  tax_amount: z.string(),
  discount_amount: z.string(),
  total: z.string(),
  created_at: z.string().datetime(),
  confirmed_at: z.string().datetime().nullable(),
  cancelled_at: z.string().datetime().nullable(),
  cancel_reason: z.string().nullable(),
  confirmed_by: z.string().nullable(),
  cancelled_by: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      menu_item_id: z.string().uuid(),
      item_name: z.string(),
      quantity: z.number().int(),
      unit_price: z.string(),
      line_total: z.string(),
      status: z.string(),
      options: z.unknown(),
      notes: z.string().nullable(),
    }),
  ),
  payments: z.array(
    z.object({
      id: z.string().uuid(),
      method: z.string(),
      amount: z.string(),
      status: z.string(),
      created_at: z.string().datetime(),
      reference: z.string().nullable(),
    }),
  ),
});

const sessionListItemSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  outlet_name: z.string(),
  table_id: z.string().uuid(),
  table_label: z.string(),
  table_seats: z.number().int().nullable(),
  table_status: z.string(),
  status: z.string(),
  opened_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable(),
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      order_number: z.number().int(),
      status: z.string(),
      total: z.string(),
      created_at: z.string().datetime(),
    }),
  ),
});

const kitchenOrderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number().int(),
  status: z.string(),
  table_label: z.string(),
  created_at: z.string().datetime(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      quantity: z.number().int(),
      status: z.string(),
      options: z.unknown(),
    }),
  ),
});

const transitionResponseSchema = z.object({
  order: z.object({
    id: z.string().uuid(),
    status: z.string(),
  }),
  previousStatus: z.string(),
});

const itemTransitionResponseSchema = z.object({
  item: z.object({
    id: z.string().uuid(),
    status: z.string(),
  }),
  previousStatus: z.string(),
});

const billRequestResponseSchema = z.object({
  success: z.boolean(),
});

const closeSessionResponseSchema = z.object({
  success: z.boolean(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/orders',
  tags: ['Orders'],
  summary: 'List orders',
  description: 'Returns paginated list of orders with filters. Requires order.create permission.',
  security: [{ cookieAuth: [] }],
  request: { query: listOrdersSchema.shape.query },
  responses: {
    200: paginatedResponse('Orders list', orderListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/orders',
  tags: ['Orders'],
  summary: 'Place order for a table (auto-confirmed)',
  description:
    'Creates a staff order for a table with auto-confirmed status (placed). Waiters and Managers can place orders on behalf of guests. Requires order.create permission.',
  security: [{ cookieAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: createStaffOrderSchema.shape.body } } },
  },
  responses: {
    201: successResponse(
      'Order created',
      z.object({
        order: z.object({
          id: z.string().uuid(),
          order_number: z.number().int(),
          status: z.string(),
          subtotal: z.string(),
          tax_amount: z.string(),
          discount_amount: z.string(),
          total: z.string(),
          created_at: z.string().datetime(),
          items: z.array(
            z.object({
              id: z.string().uuid(),
              menu_item_id: z.string().uuid(),
              name: z.string(),
              quantity: z.number().int(),
              unit_price: z.string(),
              line_total: z.string(),
              status: z.string(),
              options: z.unknown(),
              notes: z.string().nullable(),
            }),
          ),
        }),
      }),
    ),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Table not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/orders/:id',
  tags: ['Orders'],
  summary: 'Get order details',
  description: 'Returns order details with items and payments. Requires order.create permission.',
  security: [{ cookieAuth: [] }],
  request: { params: orderIdSchema.shape.params },
  responses: {
    200: successResponse('Order details', z.object({ order: orderDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/orders/:id/confirm',
  tags: ['Orders'],
  summary: 'Confirm pending guest order',
  description:
    'Confirms a pending_confirmation order, changing status to placed. Requires order.update_status permission.',
  security: [{ cookieAuth: [] }],
  request: { params: orderIdSchema.shape.params },
  responses: {
    200: successResponse('Order confirmed', z.object({ order: orderDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
    409: errorResponse('Order not in pending_confirmation status'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/orders/:id/reject',
  tags: ['Orders'],
  summary: 'Reject pending guest order',
  description:
    'Rejects a pending_confirmation order with a reason, changing status to cancelled. Requires order.update_status permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: orderIdSchema.shape.params,
    body: { content: { 'application/json': { schema: rejectOrderSchema.shape.body } } },
  },
  responses: {
    200: successResponse('Order rejected', z.object({ order: orderDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
    409: errorResponse('Order not in pending_confirmation status'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/orders/:id/status',
  tags: ['Orders'],
  summary: 'Update order status',
  description:
    'Updates order status. Valid transitions per PD-009. Requires order.update_status permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: orderIdSchema.shape.params,
    body: { content: { 'application/json': { schema: updateOrderStatusSchema.shape.body } } },
  },
  responses: {
    200: successResponse('Order status updated', transitionResponseSchema),
    400: errorResponse('Validation error or invalid transition'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
    409: errorResponse('Invalid transition'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/orders/items/:id/status',
  tags: ['Orders'],
  summary: 'Update order item status',
  description:
    'Updates order item status (placed -> preparing -> ready -> served). Requires order.update_status permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: orderIdSchema.shape.params,
    body: { content: { 'application/json': { schema: updateOrderItemStatusSchema.shape.body } } },
  },
  responses: {
    200: successResponse('Item status updated', itemTransitionResponseSchema),
    400: errorResponse('Validation error or invalid transition'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Item not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/orders/:id',
  tags: ['Orders'],
  summary: 'Cancel order',
  description:
    'Cancels an order with a reason. Enforces PD-008 cancellation rules. Requires order.cancel permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: orderIdSchema.shape.params,
    body: { content: { 'application/json': { schema: cancelOrderSchema.shape.body } } },
  },
  responses: {
    200: successResponse('Order cancelled', z.object({ order: orderDetailSchema })),
    400: errorResponse('Validation error or invalid cancellation'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
    409: errorResponse('Cannot cancel in current status'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/kitchen/board',
  tags: ['Orders', 'Kitchen'],
  summary: 'Get kitchen board',
  description:
    'Returns live kitchen board with orders grouped by status: placed, preparing, ready, served. Requires order.create permission.',
  security: [{ cookieAuth: [] }],
  request: { query: kitchenBoardSchema.shape.query },
  responses: {
    200: successResponse('Kitchen board', z.object({ orders: z.array(kitchenOrderSchema) })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/sessions/:id/request-bill',
  tags: ['Sessions'],
  summary: 'Request bill for session',
  description:
    'Guest requests bill via public API. Sets table status to needs_bill and emits socket event to waiters/managers. Requires valid session cookie.',
  security: [{ guestAuth: [] }],
  request: { params: sessionIdSchema.shape.params },
  responses: {
    200: successResponse('Bill requested', billRequestResponseSchema),
    400: errorResponse('Validation error'),
    401: errorResponse('Invalid session'),
    404: errorResponse('Session not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/sessions/:id/close',
  tags: ['Sessions'],
  summary: 'Close session',
  description:
    'Waiter/Manager closes session, completes all orders, and frees the table. Requires order.create permission.',
  security: [{ cookieAuth: [] }],
  request: { params: sessionIdSchema.shape.params },
  responses: {
    200: successResponse('Session closed', closeSessionResponseSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Session not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/sessions',
  tags: ['Sessions'],
  summary: 'List sessions',
  description:
    'Returns paginated list of sessions with filters. Requires order.create permission.',
  security: [{ cookieAuth: [] }],
  request: { query: listSessionsSchema.shape.query },
  responses: {
    200: paginatedResponse('Sessions list', sessionListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});