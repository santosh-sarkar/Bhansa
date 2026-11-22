import { z } from 'zod';

export const listStockMovementsSchema = z.object({
  params: z.object({
    outletId: z.string().uuid({ message: 'Invalid outlet ID' }),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    ingredient_id: z.string().uuid().optional(),
    type: z
      .enum(['restock', 'order_deduction', 'order_restore', 'adjustment', 'wastage'])
      .optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
  }),
});

export type ListStockMovementsInput = z.infer<typeof listStockMovementsSchema.shape.query>;
export type StockMovementParams = z.infer<typeof listStockMovementsSchema.shape.params>;
