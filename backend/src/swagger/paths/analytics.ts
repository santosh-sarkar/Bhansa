import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const analyticsSummarySchema = z.object({
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  revenue: z.object({
    total: z.string(),
    cash: z.string(),
    online: z.string(),
    card: z.string(),
  }),
  orders: z.object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    average_order_value: z.string(),
  }),
  items: z.object({
    total_sold: z.number().int().nonnegative(),
    top_items: z.array(
      z.object({
        menu_item_id: z.string().uuid(),
        name: z.string(),
        quantity_sold: z.number().int().nonnegative(),
        revenue: z.string(),
      }),
    ),
  }),
  payments: z.object({
    total: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  }),
});

const revenueByDaySchema = z.object({
  date: z.string(),
  revenue: z.string(),
  orders: z.number().int().nonnegative(),
  average_order_value: z.string(),
});

const topItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  name: z.string(),
  quantity_sold: z.number().int().nonnegative(),
  revenue: z.string(),
});

const peakHourSchema = z.object({
  hour: z.number().int().min(0).max(23),
  orders: z.number().int().nonnegative(),
  revenue: z.string(),
  average_order_value: z.string(),
});

const analyticsFiltersSchema = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    outlet_id: z.string().uuid().optional(),
  }),
});

const topItemsFiltersSchema = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    outlet_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/analytics/summary',
  tags: ['Analytics'],
  summary: 'Get analytics summary',
  description:
    'Returns summary analytics including revenue, orders, items sold, and payment stats. ' +
    'Requires analytics.view permission.',
  security: [{ bearerAuth: [] }],
  request: { query: analyticsFiltersSchema.shape.query },
  responses: {
    200: successResponse('Analytics summary', analyticsSummarySchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires analytics.view permission'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/analytics/revenue-by-day',
  tags: ['Analytics'],
  summary: 'Get revenue by day',
  description:
    'Returns daily revenue for the specified period. Requires analytics.view permission.',
  security: [{ bearerAuth: [] }],
  request: { query: analyticsFiltersSchema.shape.query },
  responses: {
    200: successResponse('Revenue by day', z.array(revenueByDaySchema)),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires analytics.view permission'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/analytics/top-items',
  tags: ['Analytics'],
  summary: 'Get top selling items',
  description:
    'Returns top selling items by quantity sold. Requires analytics.view permission.',
  security: [{ bearerAuth: [] }],
  request: { query: topItemsFiltersSchema.shape.query },
  responses: {
    200: successResponse('Top items', z.array(topItemSchema)),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires analytics.view permission'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/analytics/peak-hours',
  tags: ['Analytics'],
  summary: 'Get peak hours',
  description:
    'Returns order and revenue stats by hour of day. Requires analytics.view permission.',
  security: [{ bearerAuth: [] }],
  request: { query: analyticsFiltersSchema.shape.query },
  responses: {
    200: successResponse('Peak hours', z.array(peakHourSchema)),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires analytics.view permission'),
  },
});
