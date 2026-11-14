import { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { createAccessToken, createRefreshTokenRecord } from '@/services/auth/token.service';
import { hashPassword } from '@/utils/password';
import { generateFamilyId, hashToken } from '@/utils/token';

export interface AcceptInvitationResult {
  user: { id: string; email: string; full_name: string };
  organization: { id: string; name: string; slug: string };
  assignment: {
    role: { id: number; code: string; name: string };
    outlet: { id: string; name: string } | null;
  };
  tokens: { accessToken: string; refreshToken: string };
}

const invalidInvitation = (): AppError =>
  new AppError('VALIDATION_ERROR', 'Invalid or expired invitation', 400);

/**
 * Accepts a pending invitation: creates the invited account, assigns the role
 * and outlet, marks the invitation accepted and starts a signed-in session.
 */
export async function acceptInvitation(
  token: string,
  fullName: string,
  password: string,
): Promise<AcceptInvitationResult> {
  const invitation = await prisma.invitation.findFirst({
    where: { token_hash: hashToken(token) },
    include: {
      role: { select: { id: true, code: true, name: true } },
      outlet: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!invitation) {
    throw invalidInvitation();
  }

  if (invitation.status === 'accepted') {
    throw new AppError('CONFLICT', 'Invitation has already been accepted', 409);
  }

  if (invitation.status !== 'pending') {
    throw invalidInvitation();
  }

  if (invitation.expires_at.getTime() <= Date.now()) {
    await prisma.invitation.updateMany({
      where: { id: invitation.id, status: 'pending' },
      data: { status: 'expired' },
    });

    throw invalidInvitation();
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError('CONFLICT', 'An account with this email already exists', 409);
  }

  const passwordHash = await hashPassword(password);
  const familyId = generateFamilyId();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Only one acceptance may consume the pending invitation.
        const consumed = await tx.invitation.updateMany({
          where: { id: invitation.id, status: 'pending', expires_at: { gt: new Date() } },
          data: { status: 'accepted' },
        });

        if (consumed.count !== 1) {
          throw new AppError('CONFLICT', 'Invitation is no longer available', 409);
        }

        const user = await tx.user.create({
          data: {
            organization_id: invitation.organization_id,
            email: invitation.email,
            password_hash: passwordHash,
            full_name: fullName,
            // Receiving the emailed token proves ownership of the address.
            email_verified_at: new Date(),
          },
        });

        await tx.staffAssignment.create({
          data: {
            user_id: user.id,
            role_id: invitation.role_id,
            outlet_id: invitation.outlet_id,
          },
        });

        const { token: refreshToken } = await createRefreshTokenRecord(tx, user.id, familyId);

        return { user, refreshToken };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30_000,
        maxWait: 10_000,
      },
    );

    const accessToken = await createAccessToken(result.user);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        full_name: result.user.full_name,
      },
      organization: invitation.organization,
      assignment: {
        role: invitation.role,
        outlet: invitation.outlet,
      },
      tokens: { accessToken, refreshToken: result.refreshToken },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('CONFLICT', 'An account with this email already exists', 409);
    }

    throw error;
  }
}
