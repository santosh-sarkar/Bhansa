import type { RequestHandler } from 'express';
import { jwtVerify } from 'jose';

import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { ACCESS_COOKIE_NAME, readCookie } from '@/utils/cookies';

const verifyAccessToken = async (token: string): Promise<string> => {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  const { payload } = await jwtVerify(token, secret);

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new AppError('UNAUTHENTICATED', 'Invalid token payload', 401);
  }

  return payload.sub;
};

const loadActiveUser = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      full_name: true,
      organization_id: true,
      is_super_admin: true,
      is_active: true,
      email_verified_at: true,
    },
  });

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const accessToken = readCookie(req, ACCESS_COOKIE_NAME);

  if (!accessToken) {
    next(new AppError('UNAUTHENTICATED', 'Authentication required', 401));
    return;
  }

  try {
    const userId = await verifyAccessToken(accessToken);
    const user = await loadActiveUser(userId);

    if (!user || !user.is_active || !user.email_verified_at) {
      next(new AppError('UNAUTHENTICATED', 'Authentication required', 401));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      organization_id: user.organization_id,
      is_super_admin: user.is_super_admin,
    };
    req.accessToken = accessToken;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof Error && error.name === 'JWTExpired') {
      next(new AppError('UNAUTHENTICATED', 'Access token expired', 401));
      return;
    }

    next(new AppError('UNAUTHENTICATED', 'Invalid access token', 401));
  }
};

export const optionalAuthMiddleware: RequestHandler = async (req, res, next) => {
  const accessToken = readCookie(req, ACCESS_COOKIE_NAME);

  if (!accessToken) {
    next();
    return;
  }

  try {
    const userId = await verifyAccessToken(accessToken);
    const user = await loadActiveUser(userId);

    if (user && user.is_active && user.email_verified_at) {
      req.user = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        organization_id: user.organization_id,
        is_super_admin: user.is_super_admin,
      };
      req.accessToken = accessToken;
    }
  } catch {
    // Invalid or expired tokens are ignored for optional auth.
  }

  next();
};
