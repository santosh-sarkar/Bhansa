import { Router } from 'express';
import { z } from 'zod';

import {
  cancelOrderController,
  closeSessionController,
  confirmOrderController,
  createStaffOrderController,
  getKitchenBoardController,
  getOrderController,
  listOrdersController,
  listSessionsController,
  rejectOrderController,
  requestBillController,
  updateOrderItemStatusController,
  updateOrderStatusController,
} from '@/controllers/order/order.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import {
  cancelOrderSchema,
  createStaffOrderSchema,
  kitchenBoardSchema,
  listOrdersSchema,
  listSessionsSchema,
  orderIdSchema,
  rejectOrderSchema,
  sessionIdSchema,
  updateOrderItemStatusSchema,
  updateOrderStatusSchema,
} from '@/validations/order/order.schema';

const orderRouter = Router();

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

const orderItemSchema = z.object({
  id: z.string().uuid(),
  item_name: z.string(),
  quantity: z.number().int(),
  status: z.string(),
  options: z.unknown(),
  notes: z.string().nullable(),
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

// OpenAPI registrations
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
    200: successResponse(
      'Order confirmed',
      z.object({
        order: z.object({ id: z.string().uuid(), status: z.string() }),
        previousStatus: z.string(),
      }),
    ),
    400: errorResponse('Invalid state transition'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/orders/:id/reject',
  tags: ['Orders'],
  summary: 'Reject pending guest order',
  description:
    'Rejects a pending_confirmation order with a reason, cancelling it. Requires order.update_status permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: orderIdSchema.shape.params,
    body: { content: { 'application/json': { schema: rejectOrderSchema.shape.body } } },
  },
  responses: {
    200: successResponse(
      'Order rejected',
      z.object({
        order: z.object({ id: z.string().uuid(), status: z.string() }),
        previousStatus: z.string(),
      }),
    ),
    400: errorResponse('Validation error or invalid state transition'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/orders/:id/status',
  tags: ['Orders'],
  summary: 'Update order status',
  description: 'Moves order through allowed transitions. Requires order.update_status permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: orderIdSchema.shape.params,
    body: { content: { 'application/json': { schema: updateOrderStatusSchema.shape.body } } },
  },
  responses: {
    200: successResponse(
      'Order status updated',
      z.object({
        order: z.object({ id: z.string().uuid(), status: z.string() }),
        previousStatus: z.string(),
      }),
    ),
    400: errorResponse('Invalid state transition'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/orders/:id/cancel',
  tags: ['Orders'],
  summary: 'Cancel order with reason',
  description:
    'Cancels an order with a reason. Follows PD-008 cancellation rules. Requires order.cancel permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: orderIdSchema.shape.params,
    body: { content: { 'application/json': { schema: cancelOrderSchema.shape.body } } },
  },
  responses: {
    200: successResponse(
      'Order cancelled',
      z.object({
        order: z.object({ id: z.string().uuid(), status: z.string() }),
        previousStatus: z.string(),
      }),
    ),
    400: errorResponse('Validation error or invalid cancellation'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/order-items/:id/status',
  tags: ['Orders'],
  summary: 'Update order item status',
  description: 'Updates individual order item status. Requires order.update_status permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['placed', 'preparing', 'ready', 'served', 'cancelled']),
          }),
        },
      },
    },
  },
  responses: {
    200: successResponse(
      'Item status updated',
      z.object({
        item: z.object({ id: z.string().uuid(), status: z.string() }),
        previousStatus: z.string(),
      }),
    ),
    400: errorResponse('Invalid state transition'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Order item not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/kitchen/orders',
  tags: ['Orders'],
  summary: 'Get kitchen board data',
  description:
    'Returns live kitchen board data with orders and items needing preparation. Requires order.update_status permission.',
  security: [{ cookieAuth: [] }],
  request: { query: kitchenBoardSchema.shape.query },
  responses: {
    200: successResponse('Kitchen board', z.object({ orders: z.array(kitchenOrderSchema) })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/sessions',
  tags: ['Sessions'],
  summary: 'List sessions',
  description: 'Returns paginated list of sessions. Requires order.create permission.',
  security: [{ cookieAuth: [] }],
  request: { query: listSessionsSchema.shape.query },
  responses: {
    200: paginatedResponse('Sessions list', sessionListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/sessions/:id/bill',
  tags: ['Sessions'],
  summary: 'Request bill for session',
  description:
    'Requests a bill for the session, changing status to bill_requested. Requires payment.record permission.',
  security: [{ cookieAuth: [] }],
  request: { params: sessionIdSchema.shape.params },
  responses: {
    200: successResponse('Bill requested', billRequestResponseSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Session not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/sessions/:id/close',
  tags: ['Sessions'],
  summary: 'Close session',
  description: 'Closes the session after all orders are paid. Requires payment.record permission.',
  security: [{ cookieAuth: [] }],
  request: { params: sessionIdSchema.shape.params },
  responses: {
    200: successResponse('Session closed', closeSessionResponseSchema),
    400: errorResponse('Cannot close session with unpaid orders'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Session not found'),
  },
});

// All routes require authentication
orderRouter.use(authMiddleware);

// Order routes - require order.create permission for list, order.update_status for mutations
orderRouter.get(
  '/',
  requireOrgPermission('order.create'),
  validate({ query: listOrdersSchema.shape.query }),
  listOrdersController,
);

// Staff order creation - auto-confirmed to placed
orderRouter.post(
  '/',
  requireOrgPermission('order.create'),
  validate({ body: createStaffOrderSchema.shape.body }),
  createStaffOrderController,
);

orderRouter.get(
  '/:id',
  requireOrgPermission('order.create'),
  validate({ params: orderIdSchema.shape.params }),
  getOrderController,
);

// Confirm/reject pending orders - waiter/manager
orderRouter.patch(
  '/:id/confirm',
  requireOrgPermission('order.update_status'),
  validate({ params: orderIdSchema.shape.params }),
  confirmOrderController,
);

orderRouter.patch(
  '/:id/reject',
  requireOrgPermission('order.update_status'),
  validate({ params: orderIdSchema.shape.params, body: rejectOrderSchema.shape.body }),
  rejectOrderController,
);

// General status transitions
orderRouter.patch(
  '/:id/status',
  requireOrgPermission('order.update_status'),
  validate({ params: orderIdSchema.shape.params, body: updateOrderStatusSchema.shape.body }),
  updateOrderStatusController,
);

// Cancel order with reason
orderRouter.patch(
  '/:id/cancel',
  requireOrgPermission('order.cancel'),
  validate({ params: orderIdSchema.shape.params, body: cancelOrderSchema.shape.body }),
  cancelOrderController,
);

// Order item status updates
orderRouter.patch(
  '/items/:id/status',
  requireOrgPermission('order.update_status'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateOrderItemStatusSchema.shape.body,
  }),
  updateOrderItemStatusController,
);

// Kitchen board
orderRouter.get(
  '/kitchen',
  requireOrgPermission('order.update_status'),
  validate({ query: kitchenBoardSchema.shape.query }),
  getKitchenBoardController,
);

// Session routes
orderRouter.get(
  '/sessions',
  requireOrgPermission('order.create'),
  validate({ query: listSessionsSchema.shape.query }),
  listSessionsController,
);

orderRouter.post(
  '/sessions/:id/bill',
  requireOrgPermission('payment.record'),
  validate({ params: sessionIdSchema }),
  requestBillController,
);

orderRouter.post(
  '/sessions/:id/close',
  requireOrgPermission('payment.record'),
  validate({ params: sessionIdSchema }),
  closeSessionController,
);

export { orderRouter };
