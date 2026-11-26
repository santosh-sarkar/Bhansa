import type { Request, Response } from 'express';

import { env } from '@/config/env';

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
export const GUEST_COOKIE_NAME = 'guest_token';
export const GUEST_COOKIE_PATH = '/api/v1/public';

export const REFRESH_TOKEN_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
export const GUEST_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN,
};

export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown>;
  const value = cookies[name];
  return typeof value === 'string' ? value : undefined;
}

export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE_NAME, token, { ...BASE_COOKIE_OPTIONS });
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...BASE_COOKIE_OPTIONS,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function setGuestCookie(res: Response, token: string): void {
  res.cookie(GUEST_COOKIE_NAME, token, {
    ...BASE_COOKIE_OPTIONS,
    path: GUEST_COOKIE_PATH,
    maxAge: GUEST_TOKEN_TTL_MS,
  });
}

export function clearGuestCookie(res: Response): void {
  res.clearCookie(GUEST_COOKIE_NAME, {
    ...BASE_COOKIE_OPTIONS,
    path: GUEST_COOKIE_PATH,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...BASE_COOKIE_OPTIONS,
    path: REFRESH_COOKIE_PATH,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...BASE_COOKIE_OPTIONS,
    path: REFRESH_COOKIE_PATH,
  });
}
