import { z } from 'zod';

export const placeOrderSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
          quantity: z.number().int().positive({ message: 'Quantity must be positive' }),
          options: z
            .array(
              z.object({
                optionId: z.string().uuid({ message: 'Invalid option ID' }),
                quantity: z.number().int().positive(),
              }),
            )
            .optional(),
        }),
      )
      .min(1, 'At least one item is required'),
    idempotencyKey: z.string().min(1, 'Idempotency key is required'),
    notes: z.string().max(500, 'Notes too long').optional(),
  }),
});

export const orderIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid order ID' }),
  }),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type OrderIdInput = z.infer<typeof orderIdSchema>;
