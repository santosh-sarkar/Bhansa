import { z } from 'zod';

export const listOutletStockSchema = z.object({
  params: z.object({
    outletId: z.string().uuid({ message: 'Invalid outlet ID' }),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    is_low: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    search: z.string().max(100).optional(),
  }),
});

export const outletStockIdSchema = z.object({
  params: z.object({
    outletId: z.string().uuid({ message: 'Invalid outlet ID' }),
    ingredientId: z.string().uuid({ message: 'Invalid ingredient ID' }),
  }),
});

export const updateOutletStockSchema = z.object({
  params: z.object({
    outletId: z.string().uuid({ message: 'Invalid outlet ID' }),
    ingredientId: z.string().uuid({ message: 'Invalid ingredient ID' }),
  }),
  body: z.object({
    low_threshold: z
      .string()
      .regex(
        /^\d+(\.\d{1,3})?$/,
        'Low threshold must be a valid decimal with up to 3 decimal places',
      )
      .optional(),
  }),
});

export const bulkUpdateLowThresholdSchema = z.object({
  params: z.object({
    outletId: z.string().uuid({ message: 'Invalid outlet ID' }),
  }),
  body: z.object({
    items: z
      .array(
        z.object({
          ingredient_id: z.string().uuid({ message: 'Invalid ingredient ID' }),
          low_threshold: z
            .string()
            .regex(
              /^\d+(\.\d{1,3})?$/,
              'Low threshold must be a valid decimal with up to 3 decimal places',
            ),
        }),
      )
      .min(1, 'At least one item is required'),
  }),
});

export type ListOutletStockInput = z.infer<typeof listOutletStockSchema.shape.query>;
export type OutletStockIdInput = z.infer<typeof outletStockIdSchema.shape.params>;
export type UpdateOutletStockInput = z.infer<typeof updateOutletStockSchema.shape.body>;
export type BulkUpdateLowThresholdInput = z.infer<typeof bulkUpdateLowThresholdSchema.shape.body>;
