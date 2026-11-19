import { z } from 'zod';

export const qrTokenSchema = z.object({
  params: z.object({
    qrToken: z.string().min(1, { message: 'QR token is required' }).max(128),
  }),
});

export type QrTokenInput = z.infer<typeof qrTokenSchema.shape.params>;
