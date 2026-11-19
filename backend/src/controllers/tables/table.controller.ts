import type { RequestHandler } from 'express';

import {
  listTables,
  getTable,
  createTable,
  updateTable,
  deactivateTable,
  regenerateQrToken,
} from '@/services/tables/table.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const listTablesController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const filters = req.query as unknown as {
      page: number;
      limit: number;
      is_active?: boolean;
      status?: string;
      search?: string;
    };

    const result = await listTables(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      outletId,
      filters,
    );

    sendPaginated(res, result.tables, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const getTableController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, id } = req.params as { outletId: string; id: string };

    const table = await getTable(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      outletId,
      id,
    );

    sendSuccess(res, { table });
  } catch (error) {
    next(error);
  }
};

export const createTableController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const input = req.body as { label: string; seats?: number };

    const table = await createTable(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      outletId,
      input,
    );

    sendSuccess(res, { table }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateTableController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, id } = req.params as { outletId: string; id: string };
    const input = req.body as { label?: string; seats?: number | null; is_active?: boolean };

    const table = await updateTable(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      outletId,
      id,
      input,
    );

    sendSuccess(res, { table });
  } catch (error) {
    next(error);
  }
};

export const deactivateTableController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, id } = req.params as { outletId: string; id: string };

    const table = await deactivateTable(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      outletId,
      id,
    );

    sendSuccess(res, { table });
  } catch (error) {
    next(error);
  }
};

export const regenerateQrTokenController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, id } = req.params as { outletId: string; id: string };

    const table = await regenerateQrToken(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      outletId,
      id,
    );

    sendSuccess(res, { table });
  } catch (error) {
    next(error);
  }
};
