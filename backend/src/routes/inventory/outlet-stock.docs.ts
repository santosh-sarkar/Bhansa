import { z } from 'zod';

import { registry } from '@/swagger';
import { listOutletStockSchema } from '@/validations/inventory/outlet-stock.schema';
import { updateOutletStockSchema } from '@/validations/inventory/outlet-stock.schema';
import { bulkUpdateLowThresholdSchema } from '@/validations/inventory/outlet-stock.schema';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const outletStockListItemSchema = z.object({
  outlet_id: z.string().uuid(),
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  quantity: z.string(),
  low_threshold: z.string(),
  is_low: z.boolean(),
  updated_at: z.string().datetime(),
});

const outletStockDetailSchema = z.object({
  outlet_id: z.string().uuid(),
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  quantity: z.string(),
  low_threshold: z.string(),
  is_low: z.boolean(),
  updated_at: z.string().datetime(),
  movements: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        quantity_delta: z.string(),
        balance_after: z.string(),
        unit_cost: z.string().nullable(),
        supplier: z.string().nullable(),
        reason: z.string().nullable(),
        order_id: z.string().uuid().nullable(),
        performed_by: z.string().uuid().nullable(),
        created_at: z.string().datetime(),
      }),
    )
    .optional(),
});

const outletIdParam = z.object({ outletId: z.string().uuid() });
const outletStockIdParam = z.object({
  outletId: z.string().uuid(),
  ingredientId: z.string().uuid(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/inventory/outlets/{outletId}/stock',
  tags: ['Inventory'],
  summary: 'List outlet stock',
  description:
    'Returns paginated list of stock for an outlet with optional low stock filter. Requires inventory.view permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: outletIdParam,
    query: listOutletStockSchema.shape.query,
  },
  responses: {
    200: {
      description: 'Outlet stock list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(outletStockListItemSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Outlet not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/inventory/outlets/{outletId}/stock/{ingredientId}',
  tags: ['Inventory'],
  summary: 'Get outlet stock detail',
  description:
    'Returns stock detail for a specific ingredient at an outlet with movement history. Requires inventory.view permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: outletStockIdParam,
  },
  responses: {
    200: successResponse('Outlet stock detail', z.object({ stock: outletStockDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Outlet or stock not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/inventory/outlets/{outletId}/stock/{ingredientId}',
  tags: ['Inventory'],
  summary: 'Update low threshold',
  description:
    'Updates the low stock threshold for an ingredient at an outlet. Requires inventory.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: outletStockIdParam,
    body: {
      content: { 'application/json': { schema: updateOutletStockSchema.shape.body } },
    },
  },
  responses: {
    200: successResponse('Low threshold updated', z.object({ stock: outletStockDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Outlet or ingredient not found'),
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/inventory/outlets/{outletId}/stock/low-thresholds',
  tags: ['Inventory'],
  summary: 'Bulk update low thresholds',
  description:
    'Bulk updates low stock thresholds for multiple ingredients at an outlet. Requires inventory.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: outletIdParam,
    body: {
      content: { 'application/json': { schema: bulkUpdateLowThresholdSchema.shape.body } },
    },
  },
  responses: {
    200: successResponse(
      'Low thresholds updated',
      z.object({ items: z.array(outletStockDetailSchema) }),
    ),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Outlet or ingredient not found'),
  },
});