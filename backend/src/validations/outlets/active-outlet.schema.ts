import { z } from 'zod';

export const setActiveOutletSchema = z.object({
  body: z.object({
    outlet_id: z.string().uuid({ message: 'Valid outlet ID is required' }),
  }),
});

export type SetActiveOutletInput = z.infer<typeof setActiveOutletSchema.shape.body>;
