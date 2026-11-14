import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    full_name: z.string().min(1, { message: 'Full name is required' }).max(100),
    organization_name: z.string().min(1, { message: 'Organization name is required' }).max(100),
    organization_slug: z
      .string()
      .min(2, { message: 'Slug must be at least 2 characters' })
      .max(50, { message: 'Slug must be at most 50 characters' })
      .regex(/^[a-z0-9-]+$/, {
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
      }),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema.shape.body>;
