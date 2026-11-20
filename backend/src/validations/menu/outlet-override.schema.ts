import { z } from 'zod';

export const outletOverrideItemSchema = z.object({
  outlet_id: z.string().uuid({ message: 'Invalid outlet ID' }),
  price_override: z.number().positive().max(999999.99).nullable().optional(),
  is_available: z.boolean().optional(),
  auto_unavailable: z.boolean().optional(),
});

export const outletOverrideRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid menu item ID' }),
  }),
  body: z.object({
    overrides: z.array(outletOverrideItemSchema).min(1),
  }),
});

export const toggleAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid menu item ID' }),
  }),
  body: z.object({
    outlet_id: z.string().uuid({ message: 'Invalid outlet ID' }),
    is_available: z.boolean(),
  }),
});

export type OutletOverrideItemInput = z.infer<typeof outletOverrideItemSchema>;
export type OutletOverrideRequestInput = z.infer<typeof outletOverrideRequestSchema>;
export type ToggleAvailabilityInput = z.infer<typeof toggleAvailabilitySchema>;
