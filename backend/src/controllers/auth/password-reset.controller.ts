import type { RequestHandler } from 'express';

import { forgotPasswordSchema } from '@/validations/auth/forgot-password.schema';
import { resetPasswordSchema } from '@/validations/auth/reset-password.schema';
import { requestPasswordReset } from '@/services/auth/forgot-password.service';
import { resetPassword } from '@/services/auth/reset-password.service';
import { sendSuccess } from '@/utils/response';
import { clearAuthCookies } from '@/utils/cookies';

export const forgotPasswordController: RequestHandler = async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.shape.body.parse(req.body);

    await requestPasswordReset(email);

    sendSuccess(res, { sent: true });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordController: RequestHandler = async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.shape.body.parse(req.body);

    await resetPassword(token, password);
    clearAuthCookies(res);

    sendSuccess(res, { reset: true });
  } catch (error) {
    next(error);
  }
};
