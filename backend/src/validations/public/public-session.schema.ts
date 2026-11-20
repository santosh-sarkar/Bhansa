import { z } from 'zod';

export const startSessionSchema = z.object({
  body: z.object({
    qrToken: z.string().min(1, 'QR token is required'),
  }),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
