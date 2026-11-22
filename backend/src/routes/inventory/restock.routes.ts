import { Router } from 'express';
import { z } from 'zod';

import { recordRestockController } from '@/controllers/inventory/restock.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { restockSchema } from '@/validations/inventory/restock.schema';

const restockRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

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
  security: [{ cookieAuth: [] }],
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

// All routes require authentication
restockRouter.use(authMiddleware);

// Record restock - requires inventory.restock permission (Owner, Manager)
// Express uses :paramName syntax for route parameters
restockRouter.post(
  '/outlets/:outletId/stock/restock',
  requireOrgPermission('inventory.restock'),
  validate({ params: restockSchema.shape.params, body: restockSchema.shape.body }),
  recordRestockController,
);

export { restockRouter };
