import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/utils/password';
import { generateSecureToken, hashToken } from '@/utils/token';
import { emailService } from '@/services/email/email.service';
import { AppError } from '@/errors/AppError';

const TRIAL_DAYS = 14;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

export async function registerOrganization(input: {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  organizationSlug: string;
}): Promise<{
  organization: { id: string; name: string; slug: string };
  outlet: { id: string; name: string };
  user: { id: string; email: string; fullName: string };
  subscription: { id: string; trialEndsAt: Date };
}> {
  const passwordHash = await hashPassword(input.password);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  const verificationToken = generateSecureToken();
  const verificationExpiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  const result = await prisma.$transaction(
    async (tx) => {
      const existingOrg = await tx.organization.findUnique({
        where: { slug: input.organizationSlug },
      });

      if (existingOrg) {
        throw new AppError('CONFLICT', 'Organization slug already taken', 409);
      }

      const existingUser = await tx.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new AppError('CONFLICT', 'Email already registered', 409);
      }

      const trialPlan = await tx.plan.findUnique({
        where: { code: 'trial' },
      });

      if (!trialPlan) {
        throw new AppError('INTERNAL_ERROR', 'Trial plan not configured', 500);
      }

      const ownerRole = await tx.role.findUnique({
        where: { code: 'owner' },
      });

      if (!ownerRole) {
        throw new AppError('INTERNAL_ERROR', 'Owner role not configured', 500);
      }

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.organizationSlug,
        },
      });

      const outlet = await tx.outlet.create({
        data: {
          organization_id: organization.id,
          name: 'Main Branch',
        },
      });

      const user = await tx.user.create({
        data: {
          organization_id: organization.id,
          email: input.email,
          password_hash: passwordHash,
          full_name: input.fullName,
        },
      });

      await tx.staffAssignment.create({
        data: {
          user_id: user.id,
          role_id: ownerRole.id,
          outlet_id: null,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          organization_id: organization.id,
          plan_id: trialPlan.id,
          status: 'trialing',
          trial_ends_at: trialEndsAt,
        },
      });

      // Create email verification token
      await tx.authToken.create({
        data: {
          user_id: user.id,
          purpose: 'verify_email',
          token_hash: hashToken(verificationToken),
          expires_at: verificationExpiresAt,
        },
      });

      return {
        organization,
        outlet,
        user: { ...user, fullName: user.full_name },
        subscription: { ...subscription, trialEndsAt: subscription.trial_ends_at! },
        verificationToken,
        verificationExpiresAt,
      };
    },
    {
      timeout: 30_000,
      maxWait: 10_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  // Send verification email after transaction commits
  await emailService.sendVerificationEmail(input.email, result.verificationToken);

  return {
    organization: result.organization,
    outlet: result.outlet,
    user: result.user,
    subscription: result.subscription,
  };
}
