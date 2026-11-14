import { z } from 'zod';

import { PAGINATION } from '@/config/constants';
import { STAFF_ROLE_CODES } from '@/validations/staff/invitation.schema';

export const STAFF_STATUSES = ['active', 'inactive'] as const;

export const listStaffSchema = z.object({
  query: z.object({
    status: z.enum(STAFF_STATUSES).optional(),
    role: z.enum(STAFF_ROLE_CODES).optional(),
    page: z.coerce.number().int().min(1).default(PAGINATION.defaultPage),
    limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
  }),
});

export const staffIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const changeStaffRoleSchema = z.object({
  body: z.object({
    role: z.enum(STAFF_ROLE_CODES),
  }),
});

export const setStaffAssignmentsSchema = z.object({
  body: z.object({
    outlet_ids: z.array(z.string().uuid()).default([]),
  }),
});

export type ListStaffQuery = z.infer<typeof listStaffSchema>['query'];
export type ChangeStaffRoleInput = z.infer<typeof changeStaffRoleSchema>['body'];
export type SetStaffAssignmentsInput = z.infer<typeof setStaffAssignmentsSchema>['body'];
