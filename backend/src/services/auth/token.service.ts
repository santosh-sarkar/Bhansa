import { SignJWT } from 'jose';
import type { Prisma } from '@prisma/client';

import { env } from '@/config/env';
import { REFRESH_TOKEN_TTL_MS } from '@/utils/cookies';
import { generateSecureToken, hashToken } from '@/utils/token';

export interface AccessTokenUser {
  id: string;
  organization_id: string | null;
  is_super_admin: boolean;
}

export interface IssuedRefreshToken {
  id: string;
  token: string;
  expires_at: Date;
}

export async function createAccessToken(user: AccessTokenUser): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

  return new SignJWT({ org: user.organization_id, sa: user.is_super_admin })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .setSubject(user.id)
    .sign(secret);
}

export async function createRefreshTokenRecord(
  db: Prisma.TransactionClient,
  userId: string,
  familyId: string,
): Promise<IssuedRefreshToken> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const record = await db.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      family_id: familyId,
    },
  });

  return { id: record.id, token, expires_at: expiresAt };
}
