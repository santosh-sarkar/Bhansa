import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const consolidatedSummarySchema = z.object({
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  outlets: z.number().int().nonnegative(),
  revenue: z.object({
    total: z.string(),
    by_outlet: z.array(
      z.object({
        outlet_id: z.string().uuid(),
        outlet_name: z.string(),
        revenue: z.string(),
        orders: z.number().int().nonnegative(),
      }),
    ),
  }),
  orders: z.object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    average_order_value: z.string(),
    by_outlet: z.array(
      z.object({
        outlet_id: z.string().uuid(),
        outlet_name: z.string(),
        total: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative(),
        aov: z.string(),
      }),
    ),
  }),
  items: z.object({
    total_sold: z.number().int().nonnegative(),
    top_items_overall: z.array(
      z.object({
        menu_item_id: z.string().uuid(),
        name: z.string(),
        quantity_sold: z.number().int().nonnegative(),
        revenue: z.string(),
      }),
    ),
    top_items_by_outlet: z.array(
      z.object({
        outlet_id: z.string().uuid(),
        outlet_name: z.string(),
        items: z.array(
          z.object({
            menu_item_id: z.string().uuid(),
            name: z.string(),
            quantity_sold: z.number().int().nonnegative(),
            revenue: z.string(),
          }),
        ),
      }),
    ),
  }),
  payments: z.object({
    total: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    by_method: z.object({
      cash: z.string(),
      online: z.string(),
      card: z.string(),
    }),
    by_outlet: z.array(
      z.object({
        outlet_id: z.string().uuid(),
        outlet_name: z.string(),
        total: z.string(),
        succeeded: z.string(),
      }),
    ),
  }),
  inventory: z.object({
    total_ingredients: z.number().int().nonnegative(),
    low_stock_outlets: z.number().int().nonnegative(),
    wastage_cost: z.string(),
    wastage_count: z.number().int().nonnegative(),
    by_outlet: z.array(
      z.object({
        outlet_id: z.string().uuid(),
        outlet_name: z.string(),
        low_stock: z.number().int().nonnegative(),
        wastage_cost: z.string(),
      }),
    ),
  }),
});

const consolidatedFiltersSchema = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/analytics/consolidated',
  tags: ['Analytics'],
  summary: 'Get consolidated analytics across all outlets',
  description:
    'Returns consolidated analytics across all accessible outlets for organization owners. ' +
    'Includes revenue, orders, items, payments, and inventory summaries. Requires analytics.view permission and Owner role.',
  security: [{ bearerAuth: [] }],
  request: { query: consolidatedFiltersSchema.shape.query },
  responses: {
    200: successResponse('Consolidated analytics', consolidatedSummarySchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires Owner role and analytics.view permission'),
  },
});
