import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const revenueByPlanSchema = z.object({
  plan_code: z.string(),
  plan_name: z.string(),
  amount: z.number(),
});

const statsRevenueSchema = z.object({
  total_paid: z.number(),
  this_month: z.number(),
  pending: z.number(),
  by_plan: z.array(revenueByPlanSchema),
});

const statsOrganizationsSchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  suspended: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
});

const statsSubscriptionsSchema = z.object({
  total: z.number().int().nonnegative(),
  trialing: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  grace: z.number().int().nonnegative(),
  suspended: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});

const statsPlansSchema = z.object({
  total: z.number().int().nonnegative(),
  public: z.number().int().nonnegative(),
  subscription_distribution: z.array(z.object({
    plan_id: z.string().uuid(),
    plan_code: z.string(),
    plan_name: z.string(),
    count: z.number().int().nonnegative(),
  })),
});

const statsOutletsSchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
});

const statsStaffSchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  by_role: z.array(z.object({
    role: z.string(),
    count: z.number().int().nonnegative(),
  })),
});

const statsLeadsSchema = z.object({
  total: z.number().int().nonnegative(),
  handled: z.number().int().nonnegative(),
  unhandled: z.number().int().nonnegative(),
});

const platformStatsSchema = z.object({
  organizations: statsOrganizationsSchema,
  subscriptions: statsSubscriptionsSchema,
  plans: statsPlansSchema,
  outlets: statsOutletsSchema,
  staff: statsStaffSchema,
  leads: statsLeadsSchema,
  revenue: statsRevenueSchema,
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/stats',
  tags: ['Super Admin', 'Platform Stats'],
  summary: 'Get platform-wide statistics',
  description: 'Returns comprehensive platform statistics including organizations, subscriptions, plans, outlets, staff, leads, and revenue. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: successResponse('Platform statistics', platformStatsSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
  },
});