import { z } from 'zod';

export const listMenuItemsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    category_id: z.string().uuid().optional(),
    is_active: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    is_veg: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    search: z.string().max(100).optional(),
  }),
});

export const menuItemIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid menu item ID' }),
  }),
});

export const createMenuItemSchema = z.object({
  body: z.object({
    category_id: z.string().uuid({ message: 'Invalid category ID' }),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    image_url: z.string().url().max(500).optional().or(z.literal('')),
    base_price: z.number().positive().max(999999.99),
    is_veg: z.boolean().optional(),
    prep_time_min: z.number().int().min(0).max(1440).optional(),
    sort_order: z.number().int().min(0).default(0),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid menu item ID' }),
  }),
  body: z.object({
    category_id: z.string().uuid({ message: 'Invalid category ID' }).optional(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    image_url: z.string().url().max(500).optional().or(z.literal('')).nullable(),
    base_price: z.number().positive().max(999999.99).optional(),
    is_veg: z.boolean().optional(),
    prep_time_min: z.number().int().min(0).max(1440).optional(),
    sort_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  }),
});

export type ListMenuItemsInput = z.infer<typeof listMenuItemsSchema.shape.query>;
export type MenuItemIdInput = z.infer<typeof menuItemIdSchema.shape.params>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema.shape.body>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema.shape.body>;
