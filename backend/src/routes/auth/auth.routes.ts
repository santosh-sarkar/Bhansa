import { Router } from 'express';
import { z } from 'zod';

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
import { registry } from '@/docs/openapi';

const authRouter = Router();

const registerResponseSchema = z.object({
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  outlet: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
  }),
  subscription: z.object({
    id: z.string().uuid(),
    trial_ends_at: z.string().datetime(),
  }),
});

const verifyEmailResponseSchema = z.object({
  verified: z.literal(true),
});

const resendVerificationResponseSchema = z.object({
  sent: z.literal(true),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  tags: ['Auth'],
  summary: 'Register a new organization',
  description:
    'Creates organization, default outlet "Main Branch", owner user, and trial subscription in one transaction. Owner gets "owner" role with full permissions. Email verification required before login (A-003).',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            password: z.string().min(8),
            full_name: z.string().min(1).max(100),
            organization_name: z.string().min(1).max(100),
            organization_slug: z
              .string()
              .min(2)
              .max(50)
              .regex(/^[a-z0-9-]+$/),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Registration successful',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: registerResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('VALIDATION_ERROR'),
              message: z.string(),
              details: z.array(z.object({ path: z.string(), message: z.string() })),
            }),
          }),
        },
      },
    },
    409: {
      description: 'Email or slug already taken',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('CONFLICT'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/verify-email',
  tags: ['Auth'],
  summary: 'Verify email address',
  description:
    'Verifies the email token sent during registration. Marks the user email as verified.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Email verified successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: verifyEmailResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Invalid or expired token',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('VALIDATION_ERROR'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/resend-verification',
  tags: ['Auth'],
  summary: 'Resend verification email',
  description: 'Resends the verification email. Rate limited to once per 5 minutes per email.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Verification email sent (or already verified)',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: resendVerificationResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('VALIDATION_ERROR'),
              message: z.string(),
              details: z.array(z.object({ path: z.string(), message: z.string() })),
            }),
          }),
        },
      },
    },
    409: {
      description: 'Email already verified',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('CONFLICT'),
              message: z.string(),
            }),
          }),
        },
      },
    },
    429: {
      description: 'Rate limited - recently sent',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('RATE_LIMITED'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
  }),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Auth'],
  summary: 'Login with email and password',
  description:
    'Authenticates user with email and password. Returns access token in cookie and refresh token in cookie. Blocks unverified email.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            password: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: loginResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('VALIDATION_ERROR'),
              message: z.string(),
              details: z.array(z.object({ path: z.string(), message: z.string() })),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('VALIDATION_ERROR'),
              message: z.string(),
            }),
          }),
        },
      },
    },
    403: {
      description: 'Email not verified or account deactivated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('VALIDATION_ERROR'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

const meResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    phone: z.string().nullable(),
    is_super_admin: z.boolean(),
    last_login_at: z.date().nullable(),
    created_at: z.date(),
  }),
  organization: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      status: z.string(),
      currency: z.string(),
      created_at: z.date(),
    })
    .nullable(),
  assignments: z.array(
    z.object({
      id: z.string().uuid(),
      outlet: z
        .object({
          id: z.string().uuid(),
          name: z.string(),
          is_active: z.boolean(),
          timezone: z.string(),
        })
        .nullable(),
      role: z.object({
        id: z.number().int(),
        code: z.string(),
        name: z.string(),
      }),
    }),
  ),
  permissions: z.array(z.string()),
  last_outlet: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      is_active: z.boolean(),
      timezone: z.string(),
    })
    .nullable(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  tags: ['Auth'],
  summary: 'Get current authenticated user',
  description:
    'Returns the current authenticated user with organization, assignments, and permissions.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Current user data',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: meResponseSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthenticated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('UNAUTHENTICATED'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Auth'],
  summary: 'Rotate the refresh token',
  description:
    'Reads the refresh token cookie, rotates it, and sets new access and refresh cookies. Reusing an already rotated token revokes the whole token family.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'New cookies issued',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                full_name: z.string(),
              }),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Missing, invalid, expired or reused refresh token',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('UNAUTHENTICATED'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Auth'],
  summary: 'Log out the current session',
  description:
    'Revokes the refresh-token family from the refresh cookie and clears the auth cookies.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Session ended',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ logged_out: z.literal(true) }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthenticated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('UNAUTHENTICATED'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout-all',
  tags: ['Auth'],
  summary: 'Log out every session',
  description:
    'Revokes all refresh-token families for the authenticated user and clears the auth cookies.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'All sessions ended',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ logged_out: z.literal(true) }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthenticated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('UNAUTHENTICATED'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/forgot-password',
  tags: ['Auth'],
  summary: 'Start a password reset',
  description:
    'Queues a reset email when the account exists. Always returns 200 so the response cannot reveal whether an email is registered.',
  responses: {
    200: {
      description: 'Request accepted',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ sent: z.literal(true) }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/reset-password',
  tags: ['Auth'],
  summary: 'Complete a password reset',
  description:
    'Consumes a single-use reset token, stores the new password hash and revokes every refresh-token family.',
  responses: {
    200: {
      description: 'Password changed',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ reset: z.literal(true) }),
          }),
        },
      },
    },
    400: {
      description: 'Invalid, expired or reused token, or a rejected password',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('VALIDATION_ERROR'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

const acceptInviteResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
  }),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  assignment: z.object({
    role: z.object({
      id: z.number().int(),
      code: z.string(),
      name: z.string(),
    }),
    outlet: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
      })
      .nullable(),
  }),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/accept-invite',
  tags: ['Auth'],
  summary: 'Accept a staff invitation',
  description:
    'Consumes an invitation token, creates the staff account, assigns the invited role and outlet, and signs the user in with access and refresh cookies.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: z.string().min(1),
            full_name: z.string().min(1).max(100),
            password: z.string().min(8),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Invitation accepted and session started',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: acceptInviteResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Validation error, or an invalid or expired invitation',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('VALIDATION_ERROR'),
              message: z.string(),
              details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
            }),
          }),
        },
      },
    },
    409: {
      description: 'Invitation already accepted, no longer available, or account exists',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('CONFLICT'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

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
