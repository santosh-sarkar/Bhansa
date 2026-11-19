import { z } from 'zod';

export const listCategoriesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    is_active: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    search: z.string().max(100).optional(),
  }),
});

export const categoryIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid category ID' }),
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    sort_order: z.number().int().min(0).default(0),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid category ID' }),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    sort_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  }),
});

export type ListCategoriesInput = z.infer<typeof listCategoriesSchema.shape.query>;
export type CategoryIdInput = z.infer<typeof categoryIdSchema.shape.params>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema.shape.body>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema.shape.body>;
