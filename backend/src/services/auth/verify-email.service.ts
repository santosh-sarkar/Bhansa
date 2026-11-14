import { prisma } from '@/lib/prisma';
import { hashToken, generateSecureToken } from '@/utils/token';
import { emailService } from '@/services/email/email.service';
import { AppError } from '@/errors/AppError';

export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  const authToken = await prisma.authToken.findFirst({
    where: {
      token_hash: tokenHash,
      purpose: 'verify_email',
      used_at: null,
      expires_at: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!authToken) {
    throw new AppError('VALIDATION_ERROR', 'Invalid or expired verification token', 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.authToken.update({
      where: { id: authToken.id },
      data: { used_at: new Date() },
    });

    await tx.user.update({
      where: { id: authToken.user_id },
      data: { email_verified_at: new Date() },
    });
  });
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Don't reveal if email exists
    return;
  }

  if (user.email_verified_at) {
    throw new AppError('CONFLICT', 'Email already verified', 409);
  }

  // Check if there's a recent verification token (rate limiting)
  const recentToken = await prisma.authToken.findFirst({
    where: {
      user_id: user.id,
      purpose: 'verify_email',
      created_at: { gt: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes
    },
  });

  if (recentToken) {
    throw new AppError(
      'RATE_LIMITED',
      'Verification email recently sent. Please wait before requesting again.',
      429,
    );
  }

  const verificationToken = generateSecureToken();
  const tokenHash = hashToken(verificationToken);

  await prisma.$transaction(async (tx) => {
    // Invalidate any existing unused verification tokens for this user
    await tx.authToken.updateMany({
      where: {
        user_id: user.id,
        purpose: 'verify_email',
        used_at: null,
      },
      data: { used_at: new Date() },
    });

    await tx.authToken.create({
      data: {
        user_id: user.id,
        purpose: 'verify_email',
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  await emailService.sendVerificationEmail(user.email, verificationToken);
}
