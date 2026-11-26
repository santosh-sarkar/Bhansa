import { z } from 'zod';

import { registry } from '@/swagger';
import {
  errorResponse,
  successResponse,
} from '@/swagger/schemas/common';

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

const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
  }),
  accessToken: z.string(),
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
  accessToken: z.string(),
});

// Register all auth paths
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
    201: successResponse('Registration successful', registerResponseSchema),
    400: errorResponse('Validation error'),
    409: errorResponse('Email or slug already taken'),
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
    200: successResponse('Email verified successfully', verifyEmailResponseSchema),
    400: errorResponse('Invalid or expired token'),
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
    200: successResponse('Verification email sent (or already verified)', resendVerificationResponseSchema),
    400: errorResponse('Validation error'),
    409: errorResponse('Email already verified'),
    429: errorResponse('Rate limited - recently sent'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Auth'],
  summary: 'Login with email and password',
  description:
    'Authenticates user with email and password. Returns access token in response body and refresh token in httpOnly cookie. Blocks unverified email.',
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
    200: successResponse('Login successful', loginResponseSchema),
    400: errorResponse('Validation error'),
    401: errorResponse('Invalid credentials'),
    403: errorResponse('Email not verified or account deactivated'),
  },
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
    200: successResponse('Current user data', meResponseSchema),
    401: errorResponse('Unauthenticated'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Auth'],
  summary: 'Rotate the refresh token',
  description:
    'Reads the refresh token cookie, rotates it, and returns new access token in body and refresh token in httpOnly cookie. Reusing an already rotated token revokes the whole token family.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: successResponse('New tokens issued', z.object({
      user: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        full_name: z.string(),
      }),
      accessToken: z.string(),
    })),
    401: errorResponse('Missing, invalid, expired or reused refresh token'),
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
    200: successResponse('Session ended', z.object({ logged_out: z.literal(true) })),
    401: errorResponse('Unauthenticated'),
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
    200: successResponse('All sessions ended', z.object({ logged_out: z.literal(true) })),
    401: errorResponse('Unauthenticated'),
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
    200: successResponse('Request accepted', z.object({ sent: z.literal(true) })),
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
    200: successResponse('Password changed', z.object({ reset: z.literal(true) })),
    400: errorResponse('Invalid, expired or reused token, or a rejected password'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/accept-invite',
  tags: ['Auth'],
  summary: 'Accept a staff invitation',
  description:
    'Consumes an invitation token, creates the staff account, assigns the invited role and outlet, and returns access token in response body and refresh token in httpOnly cookie.',
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
    201: successResponse('Invitation accepted and session started', acceptInviteResponseSchema),
    400: errorResponse('Validation error, or an invalid or expired invitation'),
    409: errorResponse('Invitation already accepted, no longer available, or account exists'),
  },
});