import { z } from 'zod';

export const adjustmentSchema = z.object({
  params: z.object({
    outletId: z.string().uuid({ message: 'Invalid outlet ID' }),
  }),
  body: z.object({
    ingredient_id: z.string().uuid({ message: 'Invalid ingredient ID' }),
    quantity: z
      .string()
      .regex(/^-?\d+(\.\d{1,3})?$/, 'Quantity must be a valid decimal with up to 3 decimal places'),
    unit_cost: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/)
      .optional(),
    reason: z.string().min(1).max(500),
  }),
});

export const wastageSchema = z.object({
  params: z.object({
    outletId: z.string().uuid({ message: 'Invalid outlet ID' }),
  }),
  body: z.object({
    ingredient_id: z.string().uuid({ message: 'Invalid ingredient ID' }),
    quantity: z
      .string()
      .regex(
        /^\d+(\.\d{1,3})?$/,
        'Quantity must be a positive decimal with up to 3 decimal places',
      ),
    unit_cost: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/)
      .optional(),
    reason: z.string().min(1).max(500),
  }),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema.shape.body>;
export type AdjustmentParams = z.infer<typeof adjustmentSchema.shape.params>;
export type WastageInput = z.infer<typeof wastageSchema.shape.body>;
export type WastageParams = z.infer<typeof wastageSchema.shape.params>;
