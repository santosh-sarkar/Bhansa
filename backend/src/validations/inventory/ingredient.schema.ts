import { z } from 'zod';

export const listIngredientsSchema = z.object({
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

export const ingredientIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid ingredient ID' }),
  }),
});

export const createIngredientSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    unit: z.string().min(1).max(20),
    default_cost: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/)
      .optional(),
    is_active: z.boolean().default(true),
  }),
});

export const updateIngredientSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid ingredient ID' }),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    unit: z.string().min(1).max(20).optional(),
    default_cost: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/)
      .optional(),
    is_active: z.boolean().optional(),
  }),
});

export type ListIngredientsInput = z.infer<typeof listIngredientsSchema.shape.query>;
export type IngredientIdInput = z.infer<typeof ingredientIdSchema.shape.params>;
export type CreateIngredientInput = z.infer<typeof createIngredientSchema.shape.body>;
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema.shape.body>;
