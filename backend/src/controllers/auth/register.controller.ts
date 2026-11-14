import type { RequestHandler } from 'express';

import { registerSchema } from '@/validations/auth/register.schema';
import { registerOrganization } from '@/services/auth/register.service';
import { sendSuccess } from '@/utils/response';

export const register: RequestHandler = async (req, res, next) => {
  try {
    const input = registerSchema.shape.body.parse(req.body);

    const result = await registerOrganization({
      email: input.email,
      password: input.password,
      fullName: input.full_name,
      organizationName: input.organization_name,
      organizationSlug: input.organization_slug,
    });

    sendSuccess(
      res,
      {
        organization: result.organization,
        outlet: result.outlet,
        user: { id: result.user.id, email: result.user.email, full_name: result.user.fullName },
        subscription: {
          id: result.subscription.id,
          trial_ends_at: result.subscription.trialEndsAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    next(error);
  }
};
