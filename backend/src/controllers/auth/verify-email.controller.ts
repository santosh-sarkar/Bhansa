import type { RequestHandler } from 'express';

import { verifyEmailSchema } from '@/validations/auth/verify-email.schema';
import { resendVerificationSchema } from '@/validations/auth/resend-verification.schema';
import { verifyEmail } from '@/services/auth/verify-email.service';
import { resendVerificationEmail } from '@/services/auth/verify-email.service';
import { sendSuccess } from '@/utils/response';

export const verifyEmailController: RequestHandler = async (req, res, next) => {
  try {
    const { token } = verifyEmailSchema.shape.body.parse(req.body);
    await verifyEmail(token);
    sendSuccess(res, { verified: true }, { status: 200 });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationController: RequestHandler = async (req, res, next) => {
  try {
    const { email } = resendVerificationSchema.shape.body.parse(req.body);
    await resendVerificationEmail(email);
    // Always return success to not reveal if email exists
    sendSuccess(res, { sent: true }, { status: 200 });
  } catch (error) {
    next(error);
  }
};
