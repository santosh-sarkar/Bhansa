import { Router } from 'express';
import { z } from 'zod';

import {
  listCategoriesController,
  getCategoryController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from '@/controllers/menu/category.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listCategoriesSchema,
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from '@/validations/menu/category.schema';

const categoryRouter = Router();

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

const categoryDetailSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  menuItems: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        base_price: z.string(),
        is_active: z.boolean(),
      }),
    )
    .optional(),
});

const categoryListItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  _count: z
    .object({
      menuItems: z.number().int(),
    })
    .optional(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/categories',
  tags: ['Menu'],
  summary: 'List menu categories',
  description:
    'Returns paginated list of menu categories for the organization. Requires menu.edit permission or organization-wide access (Owner).',
  security: [{ cookieAuth: [] }],
  request: {
    query: listCategoriesSchema.shape.query,
  },
  responses: {
    200: paginatedResponse('Categories list', categoryListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/categories/{id}',
  tags: ['Menu'],
  summary: 'Get category details',
  description:
    'Returns category details with its menu items. Requires menu.edit permission or organization-wide access (Owner).',
  security: [{ cookieAuth: [] }],
  request: {
    params: categoryIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Category details', z.object({ category: categoryDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Category not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/menu/categories',
  tags: ['Menu'],
  summary: 'Create a new category',
  description: 'Creates a new menu category in the organization. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: createCategorySchema.shape.body },
      },
    },
  },
  responses: {
    201: successResponse('Category created', z.object({ category: categoryDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    409: errorResponse('Category name already exists'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/menu/categories/{id}',
  tags: ['Menu'],
  summary: 'Update category',
  description:
    'Updates category name, sort_order, or active status. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: categoryIdSchema.shape.params,
    body: {
      content: { 'application/json': { schema: updateCategorySchema.shape.body } },
    },
  },
  responses: {
    200: successResponse('Category updated', z.object({ category: categoryDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Category not found'),
    409: errorResponse('Category name already exists'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/menu/categories/{id}',
  tags: ['Menu'],
  summary: 'Delete category',
  description:
    'Soft deletes a category (sets is_active=false). Only allowed if category has no active menu items. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: categoryIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Category deactivated', z.object({ category: categoryDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Category not found'),
    409: errorResponse('Cannot delete category with active menu items'),
  },
});

// All routes require authentication
categoryRouter.use(authMiddleware);

// List categories - requires menu.edit permission (organization-wide)
categoryRouter.get(
  '/categories',
  requireOrgPermission('menu.edit'),
  validate({ query: listCategoriesSchema.shape.query }),
  listCategoriesController,
);

// Get category details - requires menu.edit permission (organization-wide)
categoryRouter.get(
  '/categories/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: categoryIdSchema.shape.params }),
  getCategoryController,
);

// Create category - requires menu.edit permission (organization-wide)
categoryRouter.post(
  '/categories',
  requireOrgPermission('menu.edit'),
  validate({ body: createCategorySchema.shape.body }),
  createCategoryController,
);

// Update category - requires menu.edit permission (organization-wide)
categoryRouter.patch(
  '/categories/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: categoryIdSchema.shape.params, body: updateCategorySchema.shape.body }),
  updateCategoryController,
);

// Delete category - requires menu.edit permission (organization-wide)
categoryRouter.delete(
  '/categories/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: categoryIdSchema.shape.params }),
  deleteCategoryController,
);

export { categoryRouter };
