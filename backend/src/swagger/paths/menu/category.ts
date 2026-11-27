import { z } from 'zod';

import { registry } from '@/swagger';
import { listCategoriesSchema } from '@/validations/menu/category.schema';
import { categoryIdSchema } from '@/validations/menu/category.schema';
import { createCategorySchema } from '@/validations/menu/category.schema';
import { updateCategorySchema } from '@/validations/menu/category.schema';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

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
  security: [{ bearerAuth: [] }],
  request: {
    query: listCategoriesSchema.shape.query,
  },
  responses: {
    200: {
      description: 'Categories list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(categoryListItemSchema),
        },
      },
    },
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
