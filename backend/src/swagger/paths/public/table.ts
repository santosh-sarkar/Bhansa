import { z } from 'zod';

import { registry } from '@/swagger';
import { qrTokenSchema } from '@/validations/public/public-table.schema';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const publicTableResolutionSchema = z.object({
  table: z.object({
    id: z.string().uuid(),
    label: z.string(),
    seats: z.number().int().nullable(),
    qr_token: z.string(),
    status: z.string(),
    is_active: z.boolean(),
  }),
  outlet: z.object({
    id: z.string().uuid(),
    name: z.string(),
    timezone: z.string(),
    tax_percent: z.string(),
    service_charge_percent: z.string(),
  }),
  effective_menu: z.object({
    categories: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        sort_order: z.number().int(),
        items: z.array(
          z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            base_price: z.string(),
            is_active: z.boolean(),
            image_url: z.string().nullable(),
            override_price: z.string().nullable(),
          }),
        ),
      }),
    ),
  }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/public/tables/{qrToken}',
  tags: ['Public'],
  summary: 'Resolve QR token to table, outlet, and effective menu',
  description:
    'Public endpoint for guests scanning QR codes. Resolves a QR token to table, outlet, and effective menu (categories with items). No authentication required.',
  request: {
    params: qrTokenSchema.shape.params,
  },
  responses: {
    200: successResponse('QR token resolved', publicTableResolutionSchema),
    404: errorResponse('Invalid QR token or outlet not available'),
  },
});