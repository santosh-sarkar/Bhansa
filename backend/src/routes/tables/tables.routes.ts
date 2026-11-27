import { Router } from 'express';

import {
  listTablesController,
  getTableController,
  createTableController,
  updateTableController,
  deactivateTableController,
  regenerateQrTokenController,
  getTableQrImageController,
} from '@/controllers/tables/table.controller';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import {
  listTablesSchema,
  tableIdSchema,
  createTableSchema,
  updateTableSchema,
} from '@/validations/tables/table.schema';

const tablesRouter = Router({ mergeParams: true });

// All routes require authentication
tablesRouter.use(authMiddleware);

// List tables - requires outlet context
tablesRouter.get(
  '/',
  outletContextMiddleware,
  validate({ query: listTablesSchema.shape.query }),
  listTablesController,
);

// Get table details
tablesRouter.get(
  '/:id',
  validate({ params: tableIdSchema.shape.params }),
  outletContextMiddleware,
  getTableController,
);

// Create table - requires tables.manage permission
tablesRouter.post(
  '/',
  validate({ body: createTableSchema.shape.body }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  createTableController,
);

// Update table - requires tables.manage permission
tablesRouter.patch(
  '/:id',
  validate({ params: tableIdSchema.shape.params, body: updateTableSchema.shape.body }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  updateTableController,
);

// Deactivate table - requires tables.manage permission
tablesRouter.delete(
  '/:id',
  validate({ params: tableIdSchema.shape.params }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  deactivateTableController,
);

// Regenerate QR token - requires tables.manage permission
tablesRouter.post(
  '/:id/regenerate-qr',
  validate({ params: tableIdSchema.shape.params }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  regenerateQrTokenController,
);

// Get QR code image
tablesRouter.get(
  '/:id/qr',
  validate({ params: tableIdSchema.shape.params }),
  outletContextMiddleware,
  getTableQrImageController,
);

export { tablesRouter };