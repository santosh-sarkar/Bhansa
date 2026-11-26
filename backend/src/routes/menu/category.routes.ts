import { Router } from 'express';

import {
  listCategoriesController,
  getCategoryController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from '@/controllers/menu/category.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listCategoriesSchema,
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from '@/validations/menu/category.schema';

import './category.docs';

const categoryRouter = Router();

// All routes require authentication
categoryRouter.use(authMiddleware);

// List categories - requires menu.edit permission (organization-wide)
categoryRouter.get(
  '/',
  requireOrgPermission('menu.edit'),
  validate({ query: listCategoriesSchema.shape.query }),
  listCategoriesController,
);

// Get category details - requires menu.edit permission (organization-wide)
categoryRouter.get(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: categoryIdSchema.shape.params }),
  getCategoryController,
);

// Create category - requires menu.edit permission (organization-wide)
categoryRouter.post(
  '/',
  requireOrgPermission('menu.edit'),
  validate({ body: createCategorySchema.shape.body }),
  createCategoryController,
);

// Update category - requires menu.edit permission (organization-wide)
categoryRouter.patch(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: categoryIdSchema.shape.params, body: updateCategorySchema.shape.body }),
  updateCategoryController,
);

// Delete category - requires menu.edit permission (organization-wide)
categoryRouter.delete(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: categoryIdSchema.shape.params }),
  deleteCategoryController,
);

export { categoryRouter };