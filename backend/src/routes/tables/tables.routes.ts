import { Router } from 'express';
import { z } from 'zod';

import {
  listTablesController,
  getTableController,
  createTableController,
  updateTableController,
  deactivateTableController,
  regenerateQrTokenController,
} from '@/controllers/tables/table.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import {
  listTablesSchema,
  tableIdSchema,
  createTableSchema,
  updateTableSchema,
} from '@/validations/tables/table.schema';

const tablesRouter = Router({ mergeParams: true });

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

const outletHeaders = z.object({ 'X-Outlet-Id': z.string().uuid() });

const tableDetailSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  label: z.string(),
  seats: z.number().int().nullable(),
  qr_token: z.string(),
  status: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

const tableListItemSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  label: z.string(),
  seats: z.number().int().nullable(),
  qr_token: z.string(),
  status: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets/{outletId}/tables',
  tags: ['Tables'],
  summary: 'List tables for an outlet',
  description:
    'Returns paginated list of tables for the outlet. Requires tables.manage permission or outlet access.',
  security: [{ cookieAuth: [] }],
  request: {
    headers: outletHeaders,
    params: z.object({ outletId: z.string().uuid() }),
    query: listTablesSchema.shape.query,
  },
  responses: {
    200: paginatedResponse('Tables list', tableListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets/{outletId}/tables/{id}',
  tags: ['Tables'],
  summary: 'Get table details',
  description: 'Returns table details including QR token and status.',
  security: [{ cookieAuth: [] }],
  request: {
    headers: outletHeaders,
    params: tableIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Table details', z.object({ table: tableDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Table not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/outlets/{outletId}/tables',
  tags: ['Tables'],
  summary: 'Create a new table',
  description: 'Creates a new table with a generated QR token. Requires tables.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    headers: outletHeaders,
    params: z.object({ outletId: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: createTableSchema.shape.body } },
    },
  },
  responses: {
    201: successResponse('Table created', z.object({ table: tableDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    409: errorResponse('Label already exists in this outlet'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/outlets/{outletId}/tables/{id}',
  tags: ['Tables'],
  summary: 'Update table',
  description: 'Updates table label, seats, or active status. Requires tables.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    headers: outletHeaders,
    params: tableIdSchema.shape.params,
    body: {
      content: { 'application/json': { schema: updateTableSchema.shape.body } },
    },
  },
  responses: {
    200: successResponse('Table updated', z.object({ table: tableDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Table not found'),
    409: errorResponse('Label already exists in this outlet'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/outlets/{outletId}/tables/{id}',
  tags: ['Tables'],
  summary: 'Deactivate table',
  description: 'Deactivates a table (soft delete). Requires tables.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    headers: outletHeaders,
    params: tableIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Table deactivated', z.object({ table: tableDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Table not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/outlets/{outletId}/tables/{id}/regenerate-qr',
  tags: ['Tables'],
  summary: 'Regenerate QR token for table',
  description: 'Generates a new QR token for the table. Requires tables.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    headers: outletHeaders,
    params: tableIdSchema.shape.params,
  },
  responses: {
    200: successResponse('QR token regenerated', z.object({ table: tableDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Table not found'),
  },
});

// All routes require authentication
tablesRouter.use(authMiddleware);

// List tables - requires outlet context
tablesRouter.get(
  '/',
  outletContextMiddleware,
  validate({ query: listTablesSchema.shape.query }),
  listTablesController,
);

// Get table details
tablesRouter.get(
  '/:id',
  validate({ params: tableIdSchema.shape.params }),
  outletContextMiddleware,
  getTableController,
);

// Create table - requires tables.manage permission
tablesRouter.post(
  '/',
  validate({ body: createTableSchema.shape.body }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  createTableController,
);

// Update table - requires tables.manage permission
tablesRouter.patch(
  '/:id',
  validate({ params: tableIdSchema.shape.params, body: updateTableSchema.shape.body }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  updateTableController,
);

// Deactivate table - requires tables.manage permission
tablesRouter.delete(
  '/:id',
  validate({ params: tableIdSchema.shape.params }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  deactivateTableController,
);

// Regenerate QR token - requires tables.manage permission
tablesRouter.post(
  '/:id/regenerate-qr',
  validate({ params: tableIdSchema.shape.params }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  regenerateQrTokenController,
);

export { tablesRouter };
