import { z } from 'zod';

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, { message: 'Token is required' }),
  }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema.shape.body>;
