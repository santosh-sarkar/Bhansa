import type { RequestHandler } from 'express';

import { logoutAllSessions, logoutSession } from '@/services/auth/logout.service';
import { sendSuccess } from '@/utils/response';
import { clearAuthCookies, readCookie, REFRESH_COOKIE_NAME } from '@/utils/cookies';

export const logoutController: RequestHandler = async (req, res, next) => {
  try {
    await logoutSession(readCookie(req, REFRESH_COOKIE_NAME));
    clearAuthCookies(res);

    sendSuccess(res, { logged_out: true });
  } catch (error) {
    next(error);
  }
};

export const logoutAllController: RequestHandler = async (req, res, next) => {
  try {
    await logoutAllSessions(req.user!.id);
    clearAuthCookies(res);

    sendSuccess(res, { logged_out: true });
  } catch (error) {
    next(error);
  }
};
