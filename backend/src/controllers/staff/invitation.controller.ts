import type { RequestHandler } from 'express';

import {
  createInvitation,
  listInvitations,
  revokeInvitation,
} from '@/services/staff/invitation.service';
import type {
  CreateInvitationInput,
  ListInvitationsQuery,
} from '@/validations/staff/invitation.schema';
import { sendSuccess } from '@/utils/response';

export const createInvitationController: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as CreateInvitationInput;

    const invitation = await createInvitation({
      actor: req.user!,
      currentOutlet: req.outlet!,
      email: body.email,
      roleCode: body.role,
      ...(body.outlet_id !== undefined ? { outletId: body.outlet_id } : {}),
    });

    sendSuccess(res, { invitation }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const listInvitationsController: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListInvitationsQuery;

    const { invitations, total } = await listInvitations({
      actor: req.user!,
      page: query.page,
      limit: query.limit,
      ...(query.status !== undefined ? { status: query.status } : {}),
    });

    sendSuccess(res, { invitations }, { meta: { page: query.page, limit: query.limit, total } });
  } catch (error) {
    next(error);
  }
};

export const revokeInvitationController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    await revokeInvitation(req.user!, id);

    sendSuccess(res, { revoked: true });
  } catch (error) {
    next(error);
  }
};
