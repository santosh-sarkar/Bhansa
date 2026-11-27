import { z } from 'zod';

import { registry } from '@/swagger';
import { adjustmentSchema } from '@/validations/inventory/adjustment.schema';
import { wastageSchema } from '@/validations/inventory/adjustment.schema';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const adjustmentResultSchema = z.object({
  outlet_id: z.string().uuid(),
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  quantity_before: z.string(),
  quantity_delta: z.string(),
  quantity_after: z.string(),
  movement_id: z.string().uuid(),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/inventory/outlets/{outletId}/stock/adjust',
  tags: ['Inventory'],
  summary: 'Record a stock adjustment',
  description:
    'Records a stock adjustment (positive or negative) for an ingredient at an outlet. Requires inventory.adjust permission (Owner, Manager, Kitchen).',
  security: [{ bearerAuth: [] }],
  request: {
    params: adjustmentSchema.shape.params,
    body: {
      content: { 'application/json': { schema: adjustmentSchema.shape.body } },
    },
  },
  responses: {
    201: successResponse('Adjustment recorded', adjustmentResultSchema),
    400: errorResponse('Validation error or would result in negative stock'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - requires inventory.adjust permission'),
    404: errorResponse('Outlet or ingredient not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/inventory/outlets/{outletId}/stock/wastage',
  tags: ['Inventory'],
  summary: 'Record stock wastage',
  description:
    'Records stock wastage for an ingredient at an outlet. Requires inventory.wastage permission (Owner, Manager, Kitchen).',
  security: [{ bearerAuth: [] }],
  request: {
    params: wastageSchema.shape.params,
    body: {
      content: { 'application/json': { schema: wastageSchema.shape.body } },
    },
  },
  responses: {
    201: successResponse('Wastage recorded', adjustmentResultSchema),
    400: errorResponse('Validation error or would result in negative stock'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - requires inventory.wastage permission'),
    404: errorResponse('Outlet or ingredient not found'),
  },
});
