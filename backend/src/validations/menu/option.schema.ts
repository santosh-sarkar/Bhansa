import { z } from 'zod';

export const listMenuItemOptionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    kind: z.enum(['variant', 'addon']).optional(),
    is_active: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  }),
});

export const menuItemOptionIdSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
    id: z.string().uuid({ message: 'Invalid option ID' }),
  }),
});

export const createMenuItemOptionSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
  }),
  body: z.object({
    kind: z.enum(['variant', 'addon']),
    name: z.string().min(1).max(100),
    price_delta: z.number().default(0),
  }),
});

export const updateMenuItemOptionSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
    id: z.string().uuid({ message: 'Invalid option ID' }),
  }),
  body: z.object({
    kind: z.enum(['variant', 'addon']).optional(),
    name: z.string().min(1).max(100).optional(),
    price_delta: z.number().optional(),
    is_active: z.boolean().optional(),
  }),
});

export type ListMenuItemOptionsInput = z.infer<typeof listMenuItemOptionsSchema.shape.query>;
export type MenuItemOptionIdInput = z.infer<typeof menuItemOptionIdSchema.shape.params>;
export type CreateMenuItemOptionInput = z.infer<typeof createMenuItemOptionSchema.shape.body>;
export type UpdateMenuItemOptionInput = z.infer<typeof updateMenuItemOptionSchema.shape.body>;
