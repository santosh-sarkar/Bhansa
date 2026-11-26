import { Router } from 'express';
import { z } from 'zod';

import {
  listLeadsController,
  getLeadController,
  markLeadHandledController,
} from '@/controllers/super-admin/lead.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

import './lead.docs';

const superAdminLeadRouter = Router();

// Validation schemas (inline)
const listLeadsQuerySchema = z.object({
  query: z.object({
    handled: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

const leadIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

// All routes require authentication and Super Admin role
superAdminLeadRouter.use(authMiddleware);
superAdminLeadRouter.use(requireSuperAdmin);

// List leads
superAdminLeadRouter.get(
  '/super-admin/leads',
  validate({ query: listLeadsQuerySchema.shape.query }),
  listLeadsController,
);

// Get lead by ID
superAdminLeadRouter.get(
  '/super-admin/leads/{id}',
  validate({ params: leadIdSchema.shape.params }),
  getLeadController,
);

// Mark lead as handled
superAdminLeadRouter.patch(
  '/super-admin/leads/{id}/handled',
  validate({ params: leadIdSchema.shape.params }),
  markLeadHandledController,
);

export { superAdminLeadRouter };