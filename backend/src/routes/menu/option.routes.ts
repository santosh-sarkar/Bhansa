import { Router } from 'express';
import { z } from 'zod';

import {
  listMenuItemOptionsController,
  getMenuItemOptionController,
  createMenuItemOptionController,
  updateMenuItemOptionController,
  deleteMenuItemOptionController,
} from '@/controllers/menu/option.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listMenuItemOptionsSchema,
  menuItemOptionIdSchema,
  createMenuItemOptionSchema,
  updateMenuItemOptionSchema,
} from '@/validations/menu/option.schema';

import './option.docs';

const optionRouter = Router();

// All routes require authentication
optionRouter.use(authMiddleware);

// List options - requires menu.edit permission
optionRouter.get(
  '/:menuItemId/options',
  requireOrgPermission('menu.edit'),
  validate({
    params: z.object({ menuItemId: z.string().uuid() }),
    query: listMenuItemOptionsSchema.shape.query,
  }),
  listMenuItemOptionsController,
);

// Get option details - requires menu.edit permission
optionRouter.get(
  '/:menuItemId/options/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemOptionIdSchema.shape.params }),
  getMenuItemOptionController,
);

// Create option - requires menu.edit permission
optionRouter.post(
  '/:menuItemId/options',
  requireOrgPermission('menu.edit'),
  validate({
    params: z.object({ menuItemId: z.string().uuid() }),
    body: createMenuItemOptionSchema.shape.body,
  }),
  createMenuItemOptionController,
);

// Update option - requires menu.edit permission
optionRouter.patch(
  '/:menuItemId/options/:id',
  requireOrgPermission('menu.edit'),
  validate({
    params: menuItemOptionIdSchema.shape.params,
    body: updateMenuItemOptionSchema.shape.body,
  }),
  updateMenuItemOptionController,
);

// Delete option - requires menu.edit permission
optionRouter.delete(
  '/:menuItemId/options/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemOptionIdSchema.shape.params }),
  deleteMenuItemOptionController,
);

export { optionRouter };