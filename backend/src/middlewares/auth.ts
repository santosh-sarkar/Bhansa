import type { Request, RequestHandler } from 'express';
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

const loadUserWithRole = async (userId: string, outletId?: string | null) => {
  // First, check if user is superadmin - if so, skip staffAssignments query entirely
  const userBase = await prisma.user.findUnique({
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

  if (!userBase || !userBase.is_active || !userBase.email_verified_at) {
    return null;
  }

  // Superadmins don't have organization-level assignments; skip the join
  if (userBase.is_super_admin) {
    return {
      id: userBase.id,
      email: userBase.email,
      full_name: userBase.full_name,
      organization_id: userBase.organization_id,
      is_super_admin: true,
      role: 'super_admin',
      outletId: null,
    };
  }

  // Regular users: load their staffAssignments for the outlet
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      full_name: true,
      organization_id: true,
      is_super_admin: true,
      is_active: true,
      email_verified_at: true,
      staffAssignments: {
        where: outletId ? { outlet_id: outletId } : { outlet_id: null },
        select: {
          role: { select: { code: true } },
          outlet_id: true,
        },
        take: 1,
      },
    },
  });

  if (!user) return null;

  const assignment = user.staffAssignments[0];
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    organization_id: user.organization_id,
    is_super_admin: user.is_super_admin,
    role: assignment?.role?.code ?? 'staff',
    outletId: assignment?.outlet_id ?? null,
  };
};

function extractAccessToken(req: Request): string | undefined {
  // Check Authorization header first (Bearer token)
  const authHeader = req.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Fallback to cookie
  return readCookie(req, ACCESS_COOKIE_NAME);
}

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const accessToken = extractAccessToken(req);

  if (!accessToken) {
    next(new AppError('UNAUTHENTICATED', 'Authentication required', 401));
    return;
  }

  try {
    const userId = await verifyAccessToken(accessToken);
    const outletId = req.get('X-Outlet-Id') ?? undefined;
    const user = await loadUserWithRole(userId, outletId);

    if (!user) {
      next(new AppError('UNAUTHENTICATED', 'Authentication required', 401));
      return;
    }

    req.user = user;
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
  const accessToken = extractAccessToken(req);

  if (!accessToken) {
    next();
    return;
  }

  try {
    const userId = await verifyAccessToken(accessToken);
    const outletId = req.get('X-Outlet-Id') ?? undefined;
    const user = await loadUserWithRole(userId, outletId);

    if (user) {
      req.user = user;
      req.accessToken = accessToken;
    }
  } catch {
    // Invalid or expired tokens are ignored for optional auth.
  }

  next();
};
