import { Router } from 'express';
import { z } from 'zod';

import {
  listOutletStockController,
  getOutletStockController,
  updateLowThresholdController,
  bulkUpdateLowThresholdController,
} from '@/controllers/inventory/outlet-stock.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listOutletStockSchema,
  outletStockIdSchema,
  updateOutletStockSchema,
  bulkUpdateLowThresholdSchema,
} from '@/validations/inventory/outlet-stock.schema';

const outletStockRouter = Router({ mergeParams: true });

// Debug middleware
outletStockRouter.use((req, res, next) => {
  console.log(
    '[DEBUG] outletStockRouter hit:',
    req.method,
    req.path,
    'params:',
    req.params,
    'baseUrl:',
    req.baseUrl,
    'originalUrl:',
    req.originalUrl,
  );
  next();
});

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
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

registry.registerPath({
  method: 'get',
  path: '/api/v1/inventory/outlets/{outletId}/stock',
  tags: ['Inventory'],
  summary: 'List outlet stock',
  description:
    'Returns paginated list of stock for an outlet with optional low stock filter. Requires inventory.view permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ outletId: z.string().uuid() }),
    query: listOutletStockSchema.shape.query,
  },
  responses: {
    200: paginatedResponse('Outlet stock list', outletStockListItemSchema),
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
    params: outletStockIdSchema.shape.params,
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
    params: outletStockIdSchema.shape.params,
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
    params: z.object({ outletId: z.string().uuid() }),
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

// All routes require authentication
outletStockRouter.use(authMiddleware);

// List outlet stock - requires inventory.view permission
outletStockRouter.get(
  '/outlets/{outletId}/stock',
  (req, res, next) => {
    console.log('[DEBUG] Route handler reached, params:', req.params);
    next();
  },
  requireOrgPermission('inventory.view'),
  validate({ query: listOutletStockSchema.shape.query }),
  listOutletStockController,
);

// Get outlet stock detail - requires inventory.view permission
outletStockRouter.get(
  '/outlets/{outletId}/stock/{ingredientId}',
  requireOrgPermission('inventory.view'),
  validate({ params: outletStockIdSchema.shape.params }),
  getOutletStockController,
);

// Update low threshold - requires inventory.manage permission
outletStockRouter.patch(
  '/outlets/{outletId}/stock/{ingredientId}',
  requireOrgPermission('inventory.manage'),
  validate({ params: outletStockIdSchema.shape.params, body: updateOutletStockSchema.shape.body }),
  updateLowThresholdController,
);

// Bulk update low thresholds - requires inventory.manage permission
outletStockRouter.put(
  '/outlets/{outletId}/stock/low-thresholds',
  requireOrgPermission('inventory.manage'),
  validate({
    params: z.object({ outletId: z.string().uuid() }),
    body: bulkUpdateLowThresholdSchema.shape.body,
  }),
  bulkUpdateLowThresholdController,
);

export { outletStockRouter };
