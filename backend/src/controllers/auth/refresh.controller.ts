import type { RequestHandler } from 'express';

import { refreshTokens } from '@/services/auth/refresh.service';
import { AppError } from '@/errors/AppError';
import { sendSuccess } from '@/utils/response';
import {
  readCookie,
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
} from '@/utils/cookies';

export const refreshController: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);

    if (!refreshToken) {
      throw new AppError('UNAUTHENTICATED', 'Refresh token required', 401);
    }

    const { user, tokens } = await refreshTokens(refreshToken);

    setRefreshTokenCookie(res, tokens.refreshToken);

    sendSuccess(res, { user, accessToken: tokens.accessToken });
  } catch (error) {
    next(error);
  }
};
