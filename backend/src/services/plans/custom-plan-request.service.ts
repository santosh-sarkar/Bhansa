import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import type { CustomPlanRequestInput } from '@/validations/plans/custom-plan-request.schema';

export interface CustomPlanLeadResponse {
  id: string;
  contact_name: string;
  contact_email: string;
  outlet_count: number | null;
  message: string | null;
  handled: boolean;
  created_at: Date;
}

export async function createCustomPlanLead(
  actor: { id: string; organization_id: string | null },
  input: CustomPlanRequestInput,
): Promise<CustomPlanLeadResponse> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const lead = await prisma.customPlanLead.create({
    data: {
      organization_id: actor.organization_id,
      contact_name: input.contact_name,
      contact_email: input.contact_email,
      outlet_count: input.outlet_count ?? null,
      message: input.message ?? null,
    },
  });

  return {
    id: lead.id,
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    outlet_count: lead.outlet_count,
    message: lead.message,
    handled: lead.handled,
    created_at: lead.created_at,
  };
}
