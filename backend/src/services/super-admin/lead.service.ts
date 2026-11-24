import { prisma } from '@/lib/prisma';
import { AppError } from '@/errors/AppError';

export interface LeadListItem {
  id: string;
  organization_id: string | null;
  organization_name: string | null;
  contact_name: string;
  contact_email: string;
  outlet_count: number | null;
  message: string | null;
  handled: boolean;
  created_at: Date;
}

export type LeadDetail = LeadListItem;

/**
 * Lists all custom plan leads for Super Admin with optional filtering.
 */
export async function listLeads(params: {
  handled?: boolean;
  page: number;
  limit: number;
}): Promise<{ leads: LeadListItem[]; total: number; totalPages: number }> {
  const { handled, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (handled !== undefined) {
    where.handled = handled;
  }

  const [leads, total] = await Promise.all([
    prisma.customPlanLead.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      include: {
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.customPlanLead.count({ where }),
  ]);

  return {
    leads: leads.map((lead) => ({
      id: lead.id,
      organization_id: lead.organization_id,
      organization_name: lead.organization?.name ?? null,
      contact_name: lead.contact_name,
      contact_email: lead.contact_email,
      outlet_count: lead.outlet_count,
      message: lead.message,
      handled: lead.handled,
      created_at: lead.created_at,
    })),
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Gets a lead by ID for Super Admin.
 */
export async function getLeadById(leadId: string): Promise<LeadDetail> {
  const lead = await prisma.customPlanLead.findUnique({
    where: { id: leadId },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  if (!lead) {
    throw new AppError('NOT_FOUND', 'Lead not found', 404);
  }

  return {
    id: lead.id,
    organization_id: lead.organization_id,
    organization_name: lead.organization?.name ?? null,
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    outlet_count: lead.outlet_count,
    message: lead.message,
    handled: lead.handled,
    created_at: lead.created_at,
  };
}

/**
 * Marks a lead as handled (Super Admin only).
 */
export async function markLeadHandled(leadId: string): Promise<LeadDetail> {
  const lead = await prisma.customPlanLead.findUnique({
    where: { id: leadId },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  if (!lead) {
    throw new AppError('NOT_FOUND', 'Lead not found', 404);
  }

  if (lead.handled) {
    throw new AppError('VALIDATION_ERROR', 'Lead is already marked as handled', 400);
  }

  const updated = await prisma.customPlanLead.update({
    where: { id: leadId },
    data: { handled: true },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  return {
    id: updated.id,
    organization_id: updated.organization_id,
    organization_name: updated.organization?.name ?? null,
    contact_name: updated.contact_name,
    contact_email: updated.contact_email,
    outlet_count: updated.outlet_count,
    message: updated.message,
    handled: updated.handled,
    created_at: updated.created_at,
  };
}