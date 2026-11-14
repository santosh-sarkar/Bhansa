import { prisma } from '@/lib/prisma';
import { hashToken } from '@/utils/token';
import { revokeAllUserFamilies, revokeFamily } from '@/services/auth/revocation.service';

/**
 * Ends the session that owns the presented refresh token. Unknown or already
 * revoked tokens are ignored so logout stays idempotent.
 */
export async function logoutSession(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) {
    return;
  }

  const stored = await prisma.refreshToken.findFirst({
    where: { token_hash: hashToken(rawRefreshToken) },
    select: { family_id: true },
  });

  if (!stored) {
    return;
  }

  await revokeFamily(stored.family_id);
}

/**
 * Revokes every refresh-token family that belongs to the user, ending all of
 * their sessions.
 */
export async function logoutAllSessions(userId: string): Promise<void> {
  await revokeAllUserFamilies(userId);
}
