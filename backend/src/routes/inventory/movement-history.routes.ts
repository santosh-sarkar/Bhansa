import { Router } from 'express';
import { z } from 'zod';

import { listStockMovementsController } from '@/controllers/inventory/movement-history.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { listStockMovementsSchema } from '@/validations/inventory/movement-history.schema';

const movementHistoryRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const paginatedResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: {
    'application/json': {
      schema: z.object({
        success: z.literal(true),
        data: z.array(data),
        pagination: z.object({
          page: z.number().int().positive(),
          limit: z.number().int().positive(),
          total: z.number().int().nonnegative(),
          totalPages: z.number().int().nonnegative(),
        }),
      }),
    },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

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

registry.registerPath({
  method: 'get',
  path: '/api/v1/inventory/outlets/{outletId}/stock/movements',
  tags: ['Inventory'],
  summary: 'List stock movements',
  description:
    'Returns paginated list of stock movements for an outlet with optional filters (ingredient, type, date range). Requires inventory.view permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ outletId: z.string().uuid() }),
    query: listStockMovementsSchema.shape.query,
  },
  responses: {
    200: paginatedResponse('Stock movements list', stockMovementItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Outlet not found'),
  },
});

// All routes require authentication
movementHistoryRouter.use(authMiddleware);

// List stock movements - requires inventory.view permission
movementHistoryRouter.get(
  '/outlets/:outletId/stock/movements',
  requireOrgPermission('inventory.view'),
  validate({ query: listStockMovementsSchema.shape.query }),
  listStockMovementsController,
);

export { movementHistoryRouter };
