import { z } from 'zod';

export const startSessionSchema = z.object({
  body: z.object({
    qrToken: z.string().min(1, 'QR token is required'),
  }),
});

export const requestBillSchema = z.object({
  body: z.object({}),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type RequestBillInput = z.infer<typeof requestBillSchema>;
