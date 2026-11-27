import { Router } from 'express';

import {
  createInvitationController,
  listInvitationsController,
  revokeInvitationController,
} from '@/controllers/staff/invitation.controller';
import {
  changeStaffAssignmentsController,
  changeStaffRoleController,
  deactivateStaffController,
  listStaffController,
} from '@/controllers/staff/staff.controller';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { requirePermission } from '@/middlewares/permission';
import { subscriptionGuardMiddleware } from '@/middlewares/subscriptionGuard';
import { validate } from '@/middlewares/validate';
import {
  createInvitationSchema,
  invitationIdSchema,
  listInvitationsSchema,
} from '@/validations/staff/invitation.schema';
import {
  changeStaffRoleSchema,
  listStaffSchema,
  setStaffAssignmentsSchema,
  staffIdSchema,
} from '@/validations/staff/staff.schema';

const staffRouter = Router();

staffRouter.use(authMiddleware, subscriptionGuardMiddleware, outletContextMiddleware);

staffRouter.get(
  '/',
  requirePermission('staff.manage'),
  validate({ query: listStaffSchema.shape.query }),
  listStaffController,
);

staffRouter.patch(
  '/:id/role',
  requirePermission('staff.manage'),
  validate({ params: staffIdSchema.shape.params, body: changeStaffRoleSchema.shape.body }),
  changeStaffRoleController,
);

staffRouter.patch(
  '/:id/deactivate',
  requirePermission('staff.manage'),
  validate({ params: staffIdSchema.shape.params }),
  deactivateStaffController,
);

staffRouter.put(
  '/:id/assignments',
  requirePermission('staff.manage'),
  validate({
    params: staffIdSchema.shape.params,
    body: setStaffAssignmentsSchema.shape.body,
  }),
  changeStaffAssignmentsController,
);

staffRouter.post(
  '/invitations',
  requirePermission('staff.manage'),
  validate({ body: createInvitationSchema.shape.body }),
  createInvitationController,
);

staffRouter.get(
  '/invitations',
  requirePermission('staff.manage'),
  validate({ query: listInvitationsSchema.shape.query }),
  listInvitationsController,
);

staffRouter.delete(
  '/invitations/:id',
  requirePermission('staff.manage'),
  validate({ params: invitationIdSchema.shape.params }),
  revokeInvitationController,
);

export { staffRouter };