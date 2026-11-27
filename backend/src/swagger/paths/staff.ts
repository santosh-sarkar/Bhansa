import { z } from 'zod';

import { registry } from '@/swagger';
import { createInvitationSchema } from '@/validations/staff/invitation.schema';
import { invitationIdSchema } from '@/validations/staff/invitation.schema';
import { listInvitationsSchema } from '@/validations/staff/invitation.schema';
import { listStaffSchema } from '@/validations/staff/staff.schema';
import { changeStaffRoleSchema } from '@/validations/staff/staff.schema';
import { setStaffAssignmentsSchema } from '@/validations/staff/staff.schema';
import { staffIdSchema } from '@/validations/staff/staff.schema';

import { INVITE_STATUSES } from '@/validations/staff/invitation.schema';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const invitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.object({ id: z.number().int(), code: z.string(), name: z.string() }),
  outlet: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  status: z.enum(INVITE_STATUSES),
  expires_at: z.string().datetime(),
  created_at: z.string().datetime(),
  invited_by: z.object({ id: z.string().uuid(), full_name: z.string() }).nullable(),
});

const metaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

const staffAssignmentSchema = z.object({
  id: z.string().uuid(),
  role: z.object({ id: z.number().int(), code: z.string(), name: z.string() }),
  outlet: z.object({ id: z.string().uuid(), name: z.string(), is_active: z.boolean() }).nullable(),
});

const staffMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  phone: z.string().nullable(),
  is_active: z.boolean(),
  last_login_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  assignments: z.array(staffAssignmentSchema),
});

const outletHeaders = z.object({ 'X-Outlet-Id': z.string().uuid() });

registry.registerPath({
  method: 'post',
  path: '/api/v1/staff/invitations',
  tags: ['Staff'],
  summary: 'Invite a staff member by email',
  description:
    'Creates a 7-day invitation for an email, role and outlet. Re-inviting the same email revokes the previous pending invitation. Manager cannot grant a role above their own or invite to an outlet they do not manage. Owner invitations are organization-wide.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: outletHeaders,
    body: {
      content: { 'application/json': { schema: createInvitationSchema.shape.body } },
    },
  },
  responses: {
    201: successResponse(
      'Invitation created and email queued',
      z.object({ invitation: invitationSchema }),
    ),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied or role hierarchy violation'),
    404: errorResponse('Target outlet not found'),
    409: errorResponse('Email already belongs to staff in this organization'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/staff/invitations',
  tags: ['Staff'],
  summary: 'List staff invitations',
  description:
    'Lists invitations the caller can manage. Owners see every invitation in the organization; Managers see invitations for their assigned outlets only. Expired pending invitations are marked expired first.',
  security: [{ bearerAuth: [] }],
  request: { headers: outletHeaders, query: listInvitationsSchema.shape.query },
  responses: {
    200: {
      description: 'Invitation page',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ invitations: z.array(invitationSchema) }),
            meta: metaSchema,
          }),
        },
      },
    },
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/staff/invitations/{id}',
  tags: ['Staff'],
  summary: 'Revoke a staff invitation',
  description:
    'Revokes a pending invitation the caller can manage. Organization-wide (Owner) invitations can only be revoked by organization-wide staff.',
  security: [{ bearerAuth: [] }],
  request: { headers: outletHeaders, params: invitationIdSchema.shape.params },
  responses: {
    200: successResponse('Invitation revoked', z.object({ revoked: z.literal(true) })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied'),
    404: errorResponse('Invitation not found'),
    409: errorResponse('Invitation is not pending'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/staff',
  tags: ['Staff'],
  summary: 'List staff',
  description:
    'Lists staff the caller can manage. Owners see every staff member in the organization; Managers see anyone assigned to an outlet they manage. Includes inactive staff and every role/outlet assignment. Supports status and role filters with pagination.',
  security: [{ bearerAuth: [] }],
  request: { headers: outletHeaders, query: listStaffSchema.shape.query },
  responses: {
    200: {
      description: 'Staff page',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ staff: z.array(staffMemberSchema) }),
            meta: metaSchema,
          }),
        },
      },
    },
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/staff/{id}/role',
  tags: ['Staff'],
  summary: 'Change a staff role',
  description:
    'Changes the role on the staff member assignments. Owner is organization-wide; demoting an Owner places them at X-Outlet-Id. Waiter and Kitchen keep a single assignment. Managers cannot change Owners, staff outside their outlets, or grant a role above their own. The last active Owner cannot be demoted.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: outletHeaders,
    params: staffIdSchema.shape.params,
    body: { content: { 'application/json': { schema: changeStaffRoleSchema.shape.body } } },
  },
  responses: {
    200: successResponse('Role changed', z.object({ staff: staffMemberSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied or role hierarchy violation'),
    404: errorResponse('Staff member not found'),
    409: errorResponse('The last active Owner cannot be demoted'),
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/staff/{id}/assignments',
  tags: ['Staff'],
  summary: 'Set staff outlet assignments',
  description:
    'Replaces the outlet assignments of a staff member. Owner targets are rejected (Owner assignments are organization-wide). Waiter and Kitchen must receive exactly one outlet; Manager may receive many. Managers can only assign outlets they manage and never manage Owners.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: outletHeaders,
    params: staffIdSchema.shape.params,
    body: { content: { 'application/json': { schema: setStaffAssignmentsSchema.shape.body } } },
  },
  responses: {
    200: successResponse('Assignments updated', z.object({ staff: staffMemberSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied'),
    404: errorResponse('Staff member or outlet not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/staff/{id}/deactivate',
  tags: ['Staff'],
  summary: 'Deactivate a staff member',
  description:
    'Sets the account inactive and revokes every refresh token. Nobody can deactivate themselves, a Manager can never deactivate an Owner, and the last active Owner cannot be deactivated.',
  security: [{ bearerAuth: [] }],
  request: { headers: outletHeaders, params: staffIdSchema.shape.params },
  responses: {
    200: successResponse('Staff member deactivated', z.object({ deactivated: z.literal(true) })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied'),
    404: errorResponse('Staff member not found'),
    409: errorResponse('Already deactivated, self-deactivation, or last active Owner'),
  },
});
