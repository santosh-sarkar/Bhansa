import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const stockReportItemSchema = z.object({
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  current_stock: z.string(),
  low_threshold: z.string(),
  is_low: z.boolean(),
  unit_cost: z.string().nullable(),
  stock_value: z.string(),
});

const wastageReportItemSchema = z.object({
  id: z.string().uuid(),
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  quantity: z.string(),
  unit_cost: z.string().nullable(),
  cost: z.string().nullable(),
  reason: z.string().nullable(),
  created_at: z.string().datetime(),
  performed_by: z.string().nullable(),
});

const usageReportItemSchema = z.object({
  type: z.string(),
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  total_quantity: z.string(),
  count: z.number().int().positive(),
});

const inventoryReportSummarySchema = z.object({
  total_ingredients: z.number().int().nonnegative(),
  low_stock_count: z.number().int().nonnegative(),
  total_stock_value: z.string(),
  total_wastage_cost: z.string(),
  wastage_count: z.number().int().nonnegative(),
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
});

const inventoryReportSchema = z.object({
  summary: inventoryReportSummarySchema,
  stock: z.array(stockReportItemSchema),
  wastage: z.array(wastageReportItemSchema),
  usage: z.array(usageReportItemSchema),
});

const consolidatedSummarySchema = z.object({
  total_outlets: z.number().int().nonnegative(),
  total_ingredients: z.number().int().nonnegative(),
  total_stock_value: z.string(),
  total_wastage_cost: z.string(),
  wastage_count: z.number().int().nonnegative(),
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
});

const consolidatedOutletSchema = z.object({
  outlet_id: z.string().uuid(),
  outlet_name: z.string(),
  total_ingredients: z.number().int().nonnegative(),
  low_stock_count: z.number().int().nonnegative(),
  stock_value: z.string(),
  wastage_cost: z.string(),
  wastage_count: z.number().int().nonnegative(),
});

const consolidatedReportSchema = z.object({
  summary: consolidatedSummarySchema,
  outlets: z.array(consolidatedOutletSchema),
});

const inventoryFiltersSchema = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/analytics/inventory/{outletId}',
  tags: ['Analytics', 'Inventory'],
  summary: 'Get inventory report for an outlet',
  description:
    'Returns comprehensive inventory report including stock levels, wastage, and usage. Requires analytics.view permission.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ outletId: z.string().uuid() }),
    query: inventoryFiltersSchema.shape.query,
  },
  responses: {
    200: successResponse('Inventory report', inventoryReportSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires analytics.view permission'),
    404: errorResponse('Outlet not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/analytics/inventory/consolidated',
  tags: ['Analytics', 'Inventory'],
  summary: 'Get consolidated inventory report across all outlets',
  description:
    'Returns consolidated inventory report across all accessible outlets. Requires analytics.view permission.',
  security: [{ bearerAuth: [] }],
  request: { query: inventoryFiltersSchema.shape.query },
  responses: {
    200: successResponse('Consolidated inventory report', consolidatedReportSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires analytics.view permission'),
  },
});
