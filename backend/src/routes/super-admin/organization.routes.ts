import { Router } from 'express';
import { z } from 'zod';

import {
  listOrganizationsController,
  getOrganizationDetailController,
  suspendOrganizationController,
  reactivateOrganizationController,
  deleteOrganizationController,
} from '@/controllers/super-admin/organization.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const superAdminOrgRouter = Router();

// Validation schemas (inline)
const listOrganizationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['pending', 'active', 'suspended']).optional(),
    search: z.string().optional(),
  }),
});

const organizationIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

// All routes require authentication and Super Admin role
superAdminOrgRouter.use(authMiddleware);
superAdminOrgRouter.use(requireSuperAdmin);

// List organizations
superAdminOrgRouter.get(
  '/super-admin/organizations',
  validate({ query: listOrganizationsSchema.shape.query }),
  listOrganizationsController,
);

// Get organization details
superAdminOrgRouter.get(
  '/super-admin/organizations/{id}',
  validate({ params: organizationIdSchema.shape.params }),
  getOrganizationDetailController,
);

// Suspend organization
superAdminOrgRouter.post(
  '/super-admin/organizations/{id}/suspend',
  validate({ params: organizationIdSchema.shape.params }),
  suspendOrganizationController,
);

// Reactivate organization
superAdminOrgRouter.post(
  '/super-admin/organizations/{id}/reactivate',
  validate({ params: organizationIdSchema.shape.params }),
  reactivateOrganizationController,
);

// Soft delete organization
superAdminOrgRouter.delete(
  '/super-admin/organizations/{id}',
  validate({ params: organizationIdSchema.shape.params }),
  deleteOrganizationController,
);

export { superAdminOrgRouter };