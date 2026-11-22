import { Router } from 'express';
import { z } from 'zod';

import {
  recordAdjustmentController,
  recordWastageController,
} from '@/controllers/inventory/adjustment.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { adjustmentSchema, wastageSchema } from '@/validations/inventory/adjustment.schema';

const adjustmentRouter = Router();

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
  security: [{ cookieAuth: [] }],
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
  security: [{ cookieAuth: [] }],
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

// All routes require authentication
adjustmentRouter.use(authMiddleware);

// Record adjustment - requires inventory.adjust permission (Owner, Manager, Kitchen)
// Express uses :paramName syntax for route parameters
adjustmentRouter.post(
  '/outlets/:outletId/stock/adjust',
  requireOrgPermission('inventory.adjust'),
  validate({ params: adjustmentSchema.shape.params, body: adjustmentSchema.shape.body }),
  recordAdjustmentController,
);

// Record wastage - requires inventory.wastage permission (Owner, Manager, Kitchen)
adjustmentRouter.post(
  '/outlets/:outletId/stock/wastage',
  requireOrgPermission('inventory.wastage'),
  validate({ params: wastageSchema.shape.params, body: wastageSchema.shape.body }),
  recordWastageController,
);

export { adjustmentRouter };
