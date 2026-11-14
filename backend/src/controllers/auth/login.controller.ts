import type { RequestHandler } from 'express';

import { loginSchema } from '@/validations/auth/login.schema';
import { loginUser } from '@/services/auth/login.service';
import { sendSuccess } from '@/utils/response';
import { setAccessTokenCookie, setRefreshTokenCookie } from '@/utils/cookies';

export const loginController: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.shape.body.parse(req.body);

    const { user, tokens } = await loginUser(email, password);

    setAccessTokenCookie(res, tokens.accessToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

    sendSuccess(
      res,
      {
        user: { id: user.id, email: user.email, full_name: user.full_name },
      },
      { status: 200 },
    );
  } catch (error) {
    next(error);
  }
};
