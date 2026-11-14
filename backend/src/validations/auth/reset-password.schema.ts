import { z } from 'zod';

// SECURITY.md: minimum 8 characters, reject very common passwords, no
// composition rules that force weak patterns.
const COMMON_PASSWORDS = new Set([
  'password',
  '12345678',
  '123456789',
  'qwerty123',
  'letmein',
  'iloveyou',
  'admin123',
  'welcome1',
]);

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, { message: 'Token is required' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), {
        message: 'Password is too common',
      }),
  }),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema.shape.body>;
