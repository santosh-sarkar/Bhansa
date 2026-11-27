import { z } from 'zod';

import { registry } from '@/swagger';
import { listTablesSchema } from '@/validations/tables/table.schema';
import { tableIdSchema } from '@/validations/tables/table.schema';
import { createTableSchema } from '@/validations/tables/table.schema';
import { updateTableSchema } from '@/validations/tables/table.schema';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

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

const outletHeaders = z.object({ 'X-Outlet-Id': z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets/{outletId}/tables',
  tags: ['Tables'],
  summary: 'List tables for an outlet',
  description:
    'Returns paginated list of tables for the outlet. Requires tables.manage permission or outlet access.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: outletHeaders,
    params: z.object({ outletId: z.string().uuid() }),
    query: listTablesSchema.shape.query,
  },
  responses: {
    200: {
      description: 'Tables list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(tableListItemSchema),
        },
      },
    },
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets/{outletId}/tables/{id}/qr',
  tags: ['Tables'],
  summary: 'Get QR code image for table',
  description:
    'Returns a PNG image of the QR code for the table. The QR code contains the table token.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: outletHeaders,
    params: tableIdSchema.shape.params,
  },
  responses: {
    200: {
      description: 'QR code image (PNG)',
      content: {
        'image/png': {
          schema: { type: 'string', format: 'binary' },
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Table not found'),
  },
});
