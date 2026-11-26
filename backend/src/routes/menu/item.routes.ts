import { Router } from 'express';

import {
  listMenuItemsController,
  getMenuItemController,
  createMenuItemController,
  updateMenuItemController,
  deleteMenuItemController,
} from '@/controllers/menu/item.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listMenuItemsSchema,
  menuItemIdSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from '@/validations/menu/item.schema';
import { planLimitMiddleware } from '@/middlewares/planLimit';

import './item.docs';

const itemRouter = Router();

// All routes require authentication
itemRouter.use(authMiddleware);

// List menu items - requires menu.edit permission
itemRouter.get(
  '/',
  requireOrgPermission('menu.edit'),
  validate({ query: listMenuItemsSchema.shape.query }),
  listMenuItemsController,
);

// Get menu item details - requires menu.edit permission
itemRouter.get(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdSchema.shape.params }),
  getMenuItemController,
);

// Create menu item - requires menu.edit permission, plan-gated by max_menu_items
itemRouter.post(
  '/',
  requireOrgPermission('menu.edit'),
  validate({ body: createMenuItemSchema.shape.body }),
  planLimitMiddleware('menuItem'),
  createMenuItemController,
);

// Update menu item - requires menu.edit permission
itemRouter.patch(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdSchema.shape.params, body: updateMenuItemSchema.shape.body }),
  updateMenuItemController,
);

// Delete menu item - requires menu.edit permission
itemRouter.delete(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdSchema.shape.params }),
  deleteMenuItemController,
);

export { itemRouter };