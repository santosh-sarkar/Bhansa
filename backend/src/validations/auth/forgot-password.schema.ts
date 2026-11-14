import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Invalid email address' }),
  }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema.shape.body>;
