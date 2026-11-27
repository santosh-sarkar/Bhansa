import { z } from 'zod';

import { registry } from '@/swagger';
import { restockSchema } from '@/validations/inventory/restock.schema';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const restockResultSchema = z.object({
  outlet_id: z.string().uuid(),
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  quantity_before: z.string(),
  quantity_added: z.string(),
  quantity_after: z.string(),
  movement_id: z.string().uuid(),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/inventory/outlets/{outletId}/stock/restock',
  tags: ['Inventory'],
  summary: 'Record a restock',
  description:
    'Records a restock for an ingredient at an outlet, updates stock quantity, and creates a movement record. Requires inventory.restock permission (Owner, Manager).',
  security: [{ bearerAuth: [] }],
  request: {
    params: restockSchema.shape.params,
    body: {
      content: { 'application/json': { schema: restockSchema.shape.body } },
    },
  },
  responses: {
    201: successResponse('Restock recorded', restockResultSchema),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - requires inventory.restock permission'),
    404: errorResponse('Outlet or ingredient not found'),
  },
});
