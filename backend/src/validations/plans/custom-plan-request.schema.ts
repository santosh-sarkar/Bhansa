import { z } from 'zod';

export const customPlanRequestSchema = z.object({
  body: z.object({
    contact_name: z.string().min(1, { message: 'Contact name is required' }).max(100),
    contact_email: z.string().email({ message: 'Valid email is required' }).max(254),
    outlet_count: z.number().int().min(1).max(100).optional(),
    message: z.string().max(2000).optional(),
  }),
});

export type CustomPlanRequestInput = z.infer<typeof customPlanRequestSchema.shape.body>;
