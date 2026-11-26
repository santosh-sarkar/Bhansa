import { Router } from 'express';

import {
  listOutletsController,
  getOutletController,
  createOutletController,
  updateOutletController,
  deactivateOutletController,
  setActiveOutletController,
} from '@/controllers/outlets/outlet.controller';
import { tablesRouter } from '@/routes/tables/tables.routes';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { requirePermission } from '@/middlewares/permission';
import { planLimitMiddleware } from '@/middlewares/planLimit';
import { validate } from '@/middlewares/validate';
import {
  listOutletsSchema,
  outletIdSchema,
  createOutletSchema,
  updateOutletSchema,
} from '@/validations/outlets/outlet.schema';
import { setActiveOutletSchema } from '@/validations/outlets/active-outlet.schema';

import './outlets.docs';

const outletsRouter = Router({ mergeParams: true });

// All routes require authentication
outletsRouter.use(authMiddleware);

// List outlets - accessible to all authenticated users in the organization
outletsRouter.get('/', validate({ query: listOutletsSchema.shape.query }), listOutletsController);

// Get outlet details - requires outlet context (X-Outlet-Id)
outletsRouter.get(
  '/:id',
  validate({ params: outletIdSchema.shape.params }),
  outletContextMiddleware,
  getOutletController,
);

// Create outlet - Owner only, plan-gated
outletsRouter.post(
  '/',
  validate({ body: createOutletSchema.shape.body }),
  outletContextMiddleware,
  requirePermission('outlets.manage'), // Owner has this
  planLimitMiddleware('outlet'),
  createOutletController,
);

// Update outlet - tables.manage or Owner
outletsRouter.patch(
  '/:id',
  validate({ params: outletIdSchema.shape.params, body: updateOutletSchema.shape.body }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  updateOutletController,
);

// Deactivate outlet - Owner only
outletsRouter.patch(
  '/:id/deactivate',
  validate({ params: outletIdSchema.shape.params }),
  outletContextMiddleware,
  requirePermission('outlets.manage'),
  deactivateOutletController,
);

// Set active outlet - Owner or Manager
outletsRouter.patch(
  '/me/active-outlet',
  validate({ body: setActiveOutletSchema.shape.body }),
  setActiveOutletController,
);

// Nested tables routes
outletsRouter.use('/:outletId/tables', tablesRouter);

export { outletsRouter };