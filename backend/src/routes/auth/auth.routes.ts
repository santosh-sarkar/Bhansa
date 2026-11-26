import { Router } from 'express';

import { register } from '@/controllers/auth/register.controller';
import { loginController } from '@/controllers/auth/login.controller';
import { getMeController } from '@/controllers/auth/me.controller';
import { refreshController } from '@/controllers/auth/refresh.controller';
import { logoutController, logoutAllController } from '@/controllers/auth/logout.controller';
import {
  forgotPasswordController,
  resetPasswordController,
} from '@/controllers/auth/password-reset.controller';
import {
  verifyEmailController,
  resendVerificationController,
} from '@/controllers/auth/verify-email.controller';
import { acceptInviteController } from '@/controllers/auth/accept-invite.controller';
import { registerSchema } from '@/validations/auth/register.schema';
import { loginSchema } from '@/validations/auth/login.schema';
import { verifyEmailSchema } from '@/validations/auth/verify-email.schema';
import { resendVerificationSchema } from '@/validations/auth/resend-verification.schema';
import { forgotPasswordSchema } from '@/validations/auth/forgot-password.schema';
import { resetPasswordSchema } from '@/validations/auth/reset-password.schema';
import { acceptInviteSchema } from '@/validations/auth/accept-invite.schema';
import { validate } from '@/middlewares/validate';
import { authMiddleware } from '@/middlewares/auth';

// Import to register OpenAPI paths
import './auth.docs';

const authRouter = Router();

authRouter.post('/register', validate({ body: registerSchema.shape.body }), register);
authRouter.post('/login', validate({ body: loginSchema.shape.body }), loginController);
authRouter.post('/refresh', refreshController);
authRouter.post('/logout', authMiddleware, logoutController);
authRouter.post('/logout-all', authMiddleware, logoutAllController);
authRouter.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema.shape.body }),
  forgotPasswordController,
);
authRouter.post(
  '/reset-password',
  validate({ body: resetPasswordSchema.shape.body }),
  resetPasswordController,
);
authRouter.get('/me', authMiddleware, getMeController);
authRouter.post(
  '/verify-email',
  validate({ body: verifyEmailSchema.shape.body }),
  verifyEmailController,
);
authRouter.post(
  '/resend-verification',
  validate({ body: resendVerificationSchema.shape.body }),
  resendVerificationController,
);
authRouter.post(
  '/accept-invite',
  validate({ body: acceptInviteSchema.shape.body }),
  acceptInviteController,
);

export { authRouter };