import { z } from 'zod';

export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(1, { message: 'Invitation token is required' }),
    full_name: z.string().min(1, { message: 'Full name is required' }).max(100),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  }),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema.shape.body>;
