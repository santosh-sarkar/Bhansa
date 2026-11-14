import { z } from 'zod';

export const subscriptionDetailSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['trialing', 'active', 'grace', 'suspended', 'cancelled']),
  plan: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    price_monthly: z.string(),
    currency: z.string(),
    max_outlets: z.number().int(),
    max_staff: z.number().int().nullable(),
    max_menu_items: z.number().int().nullable(),
    multi_outlet_enabled: z.boolean(),
    features: z.record(z.string(), z.unknown()),
  }),
  trial_ends_at: z.string().datetime().nullable(),
  grace_ends_at: z.string().datetime().nullable(),
  current_period_end: z.string().datetime().nullable(),
  max_outlets_override: z.number().int().nullable(),
  max_staff_override: z.number().int().nullable(),
  max_menu_items_override: z.number().int().nullable(),
  usage: z.object({
    outlets: z.object({ current: z.number().int(), limit: z.number().int() }),
    staff: z.object({ current: z.number().int(), limit: z.number().int().nullable() }),
    menu_items: z.object({ current: z.number().int(), limit: z.number().int().nullable() }),
  }),
});
