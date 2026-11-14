import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/utils/password';
import { hashToken } from '@/utils/token';
import { AppError } from '@/errors/AppError';
import { revokeAllUserFamilies } from '@/services/auth/revocation.service';

const invalidToken = (): AppError =>
  new AppError('VALIDATION_ERROR', 'Invalid or expired password reset token', 400);

/**
 * Completes a password reset: consumes the token, stores the new argon2id
 * hash and ends every existing session for the user.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const authToken = await prisma.authToken.findFirst({
    where: {
      token_hash: hashToken(token),
      purpose: 'reset_password',
      used_at: null,
      expires_at: { gt: new Date() },
    },
    select: { id: true, user_id: true },
  });

  if (!authToken) {
    throw invalidToken();
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    // Single use: a concurrent request must not consume the same token twice.
    const consumed = await tx.authToken.updateMany({
      where: { id: authToken.id, used_at: null },
      data: { used_at: new Date() },
    });

    if (consumed.count !== 1) {
      throw invalidToken();
    }

    await tx.user.update({
      where: { id: authToken.user_id },
      data: { password_hash: passwordHash },
    });
  });

  await revokeAllUserFamilies(authToken.user_id);
}
