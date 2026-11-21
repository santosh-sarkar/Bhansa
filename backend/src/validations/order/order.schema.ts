import { z } from 'zod';

export const listOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum([
      'pending_confirmation',
      'placed',
      'preparing',
      'ready',
      'served',
      'completed',
      'cancelled',
    ]).optional(),
    table_id: z.string().uuid().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    session_id: z.string().uuid().optional(),
  }),
});

export const orderIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid order ID' }),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid order ID' }),
  }),
  body: z.object({
    status: z.enum([
      'pending_confirmation',
      'placed',
      'preparing',
      'ready',
      'served',
      'completed',
      'cancelled',
    ]),
    reason: z.string().max(500).optional(),
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid order ID' }),
  }),
  body: z.object({
    reason: z.string().min(1, 'Cancellation reason is required').max(500),
  }),
});

export const rejectOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid order ID' }),
  }),
  body: z.object({
    reason: z.string().min(1, 'Rejection reason is required').max(500),
  }),
});

export const updateOrderItemStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid order item ID' }),
  }),
  body: z.object({
    status: z.enum(['placed', 'preparing', 'ready', 'served', 'cancelled']),
  }),
});

export const listSessionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    outlet_id: z.string().uuid().optional(),
    status: z.enum(['open', 'bill_requested', 'closed']).optional(),
  }),
});

export const sessionIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid session ID' }),
  }),
});

export const kitchenBoardSchema = z.object({
  query: z.object({
    outlet_id: z.string().uuid().optional(),
  }),
});

export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
export type OrderIdInput = z.infer<typeof orderIdSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
export type UpdateOrderItemStatusInput = z.infer<typeof updateOrderItemStatusSchema>;
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;
export type SessionIdInput = z.infer<typeof sessionIdSchema>;
export type KitchenBoardInput = z.infer<typeof kitchenBoardSchema>;