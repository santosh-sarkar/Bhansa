import { prisma } from '@/lib/prisma';
import { emailService } from '@/services/email/email.service';
import { generateSecureToken, hashToken } from '@/utils/token';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour (SECURITY.md)
const RESET_REQUEST_WINDOW_MS = 5 * 60 * 1000;

/**
 * Starts a password reset. The endpoint always succeeds so callers cannot
 * learn whether an email exists. Within the throttle window an existing token
 * is left in place instead of issuing a new one (no email spam, no signal).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.is_active) {
    return;
  }

  const recentToken = await prisma.authToken.findFirst({
    where: {
      user_id: user.id,
      purpose: 'reset_password',
      created_at: { gt: new Date(Date.now() - RESET_REQUEST_WINDOW_MS) },
    },
    select: { id: true },
  });

  if (recentToken) {
    return;
  }

  const resetToken = generateSecureToken();

  await prisma.$transaction(async (tx) => {
    // Only the newest reset link stays valid.
    await tx.authToken.updateMany({
      where: { user_id: user.id, purpose: 'reset_password', used_at: null },
      data: { used_at: new Date() },
    });

    await tx.authToken.create({
      data: {
        user_id: user.id,
        purpose: 'reset_password',
        token_hash: hashToken(resetToken),
        expires_at: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
      },
    });
  });

  await emailService.sendPasswordResetEmail(user.email, resetToken);
}
