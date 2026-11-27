import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const effectiveMenuItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  base_price: z.string(),
  is_active: z.boolean(),
  image_url: z.string().nullable(),
  override_price: z.string().nullable(),
  is_available: z.boolean(),
});

const effectiveMenuCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sort_order: z.number().int(),
  items: z.array(effectiveMenuItemSchema),
});

const effectiveMenuSchema = z.object({
  categories: z.array(effectiveMenuCategorySchema),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/effective',
  tags: ['Menu'],
  summary: 'Get effective menu for the current outlet',
  description:
    'Returns the effective menu for the outlet specified in the X-Outlet-Id header. ' +
    'Includes active categories and items with outlet-specific price overrides and availability. ' +
    'Respects is_available and auto_unavailable from outlet overrides. ' +
    'Requires authentication and valid X-Outlet-Id header. ' +
    'Accessible by any staff member assigned to the outlet (Owner, Manager, Waiter, Kitchen).',
  security: [{ bearerAuth: [] }],
  responses: {
    200: successResponse('Effective menu', effectiveMenuSchema),
    400: errorResponse('Validation error (missing or invalid X-Outlet-Id)'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden (outlet access denied)'),
  },
});
