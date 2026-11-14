import type { RequestHandler } from 'express';

import { createCustomPlanLead } from '@/services/plans/custom-plan-request.service';
import type { CustomPlanRequestInput } from '@/validations/plans/custom-plan-request.schema';
import { sendSuccess } from '@/utils/response';

export const customPlanRequestController: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as CustomPlanRequestInput;

    const lead = await createCustomPlanLead(
      {
        id: req.user!.id,
        organization_id: req.user!.organization_id ?? null,
      },
      body,
    );

    sendSuccess(res, { lead }, { status: 201 });
  } catch (error) {
    next(error);
  }
};
