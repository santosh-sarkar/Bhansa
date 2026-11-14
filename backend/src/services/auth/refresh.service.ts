import { prisma } from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { createAccessToken, createRefreshTokenRecord } from '@/services/auth/token.service';
import { revokeFamily } from '@/services/auth/revocation.service';
import { hashToken } from '@/utils/token';

export interface RefreshedUser {
  id: string;
  email: string;
  full_name: string;
}

export interface RefreshResult {
  user: RefreshedUser;
  tokens: { accessToken: string; refreshToken: string };
}

const invalidToken = (): AppError =>
  new AppError('UNAUTHENTICATED', 'Invalid or expired refresh token', 401);

export async function refreshTokens(rawToken: string): Promise<RefreshResult> {
  const stored = await prisma.refreshToken.findFirst({
    where: { token_hash: hashToken(rawToken) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          organization_id: true,
          is_super_admin: true,
          is_active: true,
          email_verified_at: true,
        },
      },
    },
  });

  if (!stored) {
    throw invalidToken();
  }

  // A token that was already rotated is being replayed: assume the family is
  // compromised and revoke every token in it.
  if (stored.used_at) {
    await revokeFamily(stored.family_id);

    throw new AppError('UNAUTHENTICATED', 'Refresh token reuse detected', 401);
  }

  if (stored.revoked_at || stored.expires_at.getTime() <= Date.now()) {
    throw invalidToken();
  }

  if (!stored.user.is_active || !stored.user.email_verified_at) {
    throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  const rotated = await prisma.$transaction(async (tx) => {
    const next = await createRefreshTokenRecord(tx, stored.user_id, stored.family_id);

    // Only one request may consume the old token; a concurrent refresh sees 0
    // rows and rolls back the transaction by throwing.
    const consumed = await tx.refreshToken.updateMany({
      where: { id: stored.id, used_at: null, revoked_at: null },
      data: { used_at: new Date(), replaced_by: next.id },
    });

    if (consumed.count !== 1) {
      throw invalidToken();
    }

    return next;
  });

  const accessToken = await createAccessToken(stored.user);

  return {
    user: {
      id: stored.user.id,
      email: stored.user.email,
      full_name: stored.user.full_name,
    },
    tokens: { accessToken, refreshToken: rotated.token },
  };
}
