import { z } from 'zod';

import { PAGINATION } from '@/config/constants';

export const STAFF_ROLE_CODES = ['owner', 'manager', 'waiter', 'kitchen'] as const;

export const INVITE_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const;

export const createInvitationSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(STAFF_ROLE_CODES),
    outlet_id: z.string().uuid().optional(),
  }),
});

export const listInvitationsSchema = z.object({
  query: z.object({
    status: z.enum(INVITE_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(PAGINATION.defaultPage),
    limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
  }),
});

export const invitationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>['body'];
export type ListInvitationsQuery = z.infer<typeof listInvitationsSchema>['query'];
