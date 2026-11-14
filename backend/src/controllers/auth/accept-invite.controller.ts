import type { RequestHandler } from 'express';

import { acceptInvitation } from '@/services/auth/accept-invite.service';
import type { AcceptInviteInput } from '@/validations/auth/accept-invite.schema';
import { setAccessTokenCookie, setRefreshTokenCookie } from '@/utils/cookies';
import { sendSuccess } from '@/utils/response';

export const acceptInviteController: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as AcceptInviteInput;

    const result = await acceptInvitation(body.token, body.full_name, body.password);

    setAccessTokenCookie(res, result.tokens.accessToken);
    setRefreshTokenCookie(res, result.tokens.refreshToken);

    sendSuccess(
      res,
      {
        user: result.user,
        organization: result.organization,
        assignment: result.assignment,
      },
      { status: 201 },
    );
  } catch (error) {
    next(error);
  }
};
