import { z } from 'zod';

import { registry } from '@/swagger';
import { listOutletsSchema } from '@/validations/outlets/outlet.schema';
import { outletIdSchema } from '@/validations/outlets/outlet.schema';
import { createOutletSchema } from '@/validations/outlets/outlet.schema';
import { updateOutletSchema } from '@/validations/outlets/outlet.schema';
import { setActiveOutletSchema } from '@/validations/outlets/active-outlet.schema';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const outletDetailSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  tax_percent: z.string(),
  service_charge_percent: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

const outletListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  tax_percent: z.string(),
  service_charge_percent: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

const outletHeaders = z.object({ 'X-Outlet-Id': z.string().uuid() });

const activeOutletResponseSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  tax_percent: z.string(),
  service_charge_percent: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets',
  tags: ['Outlets'],
  summary: 'List outlets the user can access',
  description:
    'Returns paginated list of outlets the authenticated user has access to. Owner sees all organization outlets. Manager/Waiter/Kitchen see only assigned outlets.',
  security: [{ bearerAuth: [] }],
  request: {
    query: listOutletsSchema.shape.query,
  },
  responses: {
    200: {
      description: 'Outlets list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(outletListItemSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets/{id}',
  tags: ['Outlets'],
  summary: 'Get outlet details',
  description:
    'Returns outlet details. User must have an assignment to this outlet or be organization-wide (Owner).',
  security: [{ bearerAuth: [] }],
  request: {
    params: outletIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Outlet details', z.object({ outlet: outletDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Outlet access denied'),
    404: errorResponse('Outlet not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/outlets',
  tags: ['Outlets'],
  summary: 'Create a new outlet',
  description:
    'Creates a new outlet in the organization. Only organization-wide staff (Owner) can create. Plan-gated by max_outlets limit.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: outletHeaders,
    body: {
      content: {
        'application/json': { schema: createOutletSchema.shape.body },
      },
    },
  },
  responses: {
    201: successResponse('Outlet created', z.object({ outlet: outletDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or plan limit reached'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/outlets/{id}',
  tags: ['Outlets'],
  summary: 'Update outlet profile and settings',
  description:
    'Updates outlet details. Requires tables.manage permission at the outlet or organization-wide access (Owner).',
  security: [{ bearerAuth: [] }],
  request: {
    params: outletIdSchema.shape.params,
    body: {
      content: {
        'application/json': { schema: updateOutletSchema.shape.body },
      },
    },
  },
  responses: {
    200: successResponse('Outlet updated', z.object({ outlet: outletDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Outlet access denied'),
    404: errorResponse('Outlet not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/outlets/{id}/deactivate',
  tags: ['Outlets'],
  summary: 'Deactivate outlet',
  description:
    'Deactivates an outlet (blocks new orders, keeps history). Only organization-wide staff (Owner) can deactivate.',
  security: [{ bearerAuth: [] }],
  request: {
    params: outletIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Outlet deactivated', z.object({ outlet: outletDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Outlet not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/outlets/me/active-outlet',
  tags: ['Outlets'],
  summary: 'Save last active outlet',
  description:
    'Saves the last active outlet for the current user. Owner can set any outlet in their organization. Manager can only set outlets they are assigned to.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: setActiveOutletSchema.shape.body },
      },
    },
  },
  responses: {
    200: successResponse('Active outlet saved', z.object({ outlet: activeOutletResponseSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Outlet not found'),
  },
});
