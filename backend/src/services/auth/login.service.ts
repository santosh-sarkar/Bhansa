import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/utils/password';
import { generateFamilyId } from '@/utils/token';
import { AppError } from '@/errors/AppError';
import { createAccessToken, createRefreshTokenRecord } from '@/services/auth/token.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ user: { id: string; email: string; full_name: string }; tokens: TokenPair }> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (!user) {
    throw new AppError('VALIDATION_ERROR', 'Invalid email or password', 401);
  }

  if (!user.is_active) {
    throw new AppError('VALIDATION_ERROR', 'Account is deactivated', 403);
  }

  if (!user.email_verified_at) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Email not verified. Please verify your email first.',
      403,
    );
  }

  const isValid = await verifyPassword(user.password_hash, password);
  if (!isValid) {
    throw new AppError('VALIDATION_ERROR', 'Invalid email or password', 401);
  }

  const tokens = await createTokenPair(user);

  return {
    user: { id: user.id, email: user.email, full_name: user.full_name },
    tokens,
  };
}

async function createTokenPair(user: {
  id: string;
  organization_id: string | null;
  is_super_admin: boolean;
}): Promise<TokenPair> {
  const familyId = generateFamilyId();
  const { token: refreshToken } = await createRefreshTokenRecord(prisma, user.id, familyId);
  const accessToken = await createAccessToken(user);

  return { accessToken, refreshToken };
}
