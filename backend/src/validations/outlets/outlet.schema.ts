import { z } from 'zod';

export const listOutletsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    is_active: z.coerce.boolean().optional(),
    search: z.string().max(100).optional(),
  }),
});

export const outletIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid outlet ID' }),
  }),
});

export const updateOutletSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid outlet ID' }),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    address: z.string().max(200).optional(),
    phone: z.string().max(20).optional(),
    timezone: z.string().max(50).optional(),
    tax_percent: z.number().min(0).max(100).optional(),
    service_charge_percent: z.number().min(0).max(100).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const createOutletSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(100),
      address: z.string().max(200).optional(),
      phone: z.string().max(20).optional(),
      timezone: z.string().max(50).optional(),
      tax_percent: z.number().min(0).max(100).default(13.0),
      service_charge_percent: z.number().min(0).max(100).default(10.0),
    })
    .transform((data) => ({
      ...data,
      tax_percent: data.tax_percent ?? 13.0,
      service_charge_percent: data.service_charge_percent ?? 10.0,
    })),
});

export type ListOutletsInput = z.infer<typeof listOutletsSchema.shape.query>;
export type OutletIdInput = z.infer<typeof outletIdSchema.shape.params>;
export type UpdateOutletInput = z.infer<typeof updateOutletSchema.shape.body>;
export type CreateOutletInput = z.infer<typeof createOutletSchema.shape.body>;
