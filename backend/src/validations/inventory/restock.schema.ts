import { z } from 'zod';

export const restockSchema = z.object({
  params: z.object({
    outletId: z.string().uuid({ message: 'Invalid outlet ID' }),
  }),
  body: z.object({
    ingredient_id: z.string().uuid({ message: 'Invalid ingredient ID' }),
    quantity: z
      .string()
      .regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a valid decimal with up to 3 decimal places'),
    unit_cost: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/)
      .optional(),
    supplier: z.string().max(200).optional(),
    reason: z.string().max(500).optional(),
  }),
});

export type RestockInput = z.infer<typeof restockSchema.shape.body>;
export type RestockParams = z.infer<typeof restockSchema.shape.params>;
