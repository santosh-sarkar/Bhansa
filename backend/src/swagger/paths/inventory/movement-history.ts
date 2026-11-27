import { z } from 'zod';

import { registry } from '@/swagger';
import { listStockMovementsSchema } from '@/validations/inventory/movement-history.schema';

import { errorResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const stockMovementItemSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  type: z.string(),
  quantity_delta: z.string(),
  balance_after: z.string(),
  unit_cost: z.string().nullable(),
  supplier: z.string().nullable(),
  reason: z.string().nullable(),
  order_id: z.string().uuid().nullable(),
  performed_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});

const outletIdParam = z.object({ outletId: z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/inventory/outlets/{outletId}/stock/movements',
  tags: ['Inventory'],
  summary: 'List stock movements',
  description:
    'Returns paginated list of stock movements for an outlet with optional filters (ingredient, type, date range). Requires inventory.view permission.',
  security: [{ bearerAuth: [] }],
  request: {
    params: outletIdParam,
    query: listStockMovementsSchema.shape.query,
  },
  responses: {
    200: {
      description: 'Stock movements list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(stockMovementItemSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Outlet not found'),
  },
});
