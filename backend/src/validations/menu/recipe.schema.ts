import { z } from 'zod';

export const menuItemIdSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
  }),
});

export const recipeItemIdSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
    ingredientId: z.string().uuid({ message: 'Invalid ingredient ID' }),
  }),
});

export const createRecipeItemSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
  }),
  body: z.object({
    ingredient_id: z.string().uuid({ message: 'Invalid ingredient ID' }),
    quantity: z
      .string()
      .regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a valid decimal with up to 3 decimal places'),
  }),
});

export const updateRecipeItemSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
    ingredientId: z.string().uuid({ message: 'Invalid ingredient ID' }),
  }),
  body: z.object({
    quantity: z
      .string()
      .regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a valid decimal with up to 3 decimal places')
      .optional(),
  }),
});

export const bulkUpsertRecipeSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
  }),
  body: z.object({
    items: z
      .array(
        z.object({
          ingredient_id: z.string().uuid({ message: 'Invalid ingredient ID' }),
          quantity: z
            .string()
            .regex(
              /^\d+(\.\d{1,3})?$/,
              'Quantity must be a valid decimal with up to 3 decimal places',
            ),
        }),
      )
      .min(1, 'At least one recipe item is required'),
  }),
});

export type MenuItemIdInput = z.infer<typeof menuItemIdSchema.shape.params>;
export type RecipeItemIdInput = z.infer<typeof recipeItemIdSchema.shape.params>;
export type CreateRecipeItemInput = z.infer<typeof createRecipeItemSchema.shape.body>;
export type UpdateRecipeItemInput = z.infer<typeof updateRecipeItemSchema.shape.body>;
export type BulkUpsertRecipeInput = z.infer<typeof bulkUpsertRecipeSchema.shape.body>;
