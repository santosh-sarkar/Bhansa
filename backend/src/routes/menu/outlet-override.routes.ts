import { Router } from 'express';
import { z } from 'zod';

import {
  getMenuItemOutletOverridesController,
  toggleMenuItemAvailabilityController,
  updateMenuItemOutletOverridesController,
} from '@/controllers/menu/outlet-override.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { toggleAvailabilitySchema } from '@/validations/menu/outlet-override.schema';

import './outlet-override.docs';

const outletOverrideRouter = Router();

outletOverrideRouter.use(authMiddleware);

outletOverrideRouter.get(
  '/:id/outlet-overrides',
  requireOrgPermission('menu.edit'),
  getMenuItemOutletOverridesController,
);

outletOverrideRouter.put(
  '/:id/outlet-overrides',
  requireOrgPermission('menu.edit'),
  validate({
    body: z.object({
      overrides: z.array(
        z.object({
          outlet_id: z.string().uuid(),
          price_override: z.number().positive().max(999999.99).nullable().optional(),
          is_available: z.boolean().optional(),
          auto_unavailable: z.boolean().optional(),
        }),
      ),
    }),
  }),
  updateMenuItemOutletOverridesController,
);

outletOverrideRouter.patch(
  '/:id/availability',
  requireOrgPermission('item.mark_unavailable'),
  validate({
    params: toggleAvailabilitySchema.shape.params,
    body: toggleAvailabilitySchema.shape.body,
  }),
  toggleMenuItemAvailabilityController,
);

export { outletOverrideRouter };