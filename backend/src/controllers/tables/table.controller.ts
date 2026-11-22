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
import QRCode from 'qrcode';

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

    const result = await listTables(req.user!, outletId, filters);

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

    const table = await getTable(req.user!, outletId, id);

    sendSuccess(res, { table });
  } catch (error) {
    next(error);
  }
};

export const createTableController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const input = req.body as { label: string; seats?: number };

    const table = await createTable(req.user!, outletId, input);

    sendSuccess(res, { table }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateTableController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, id } = req.params as { outletId: string; id: string };
    const input = req.body as { label?: string; seats?: number | null; is_active?: boolean };

    const table = await updateTable(req.user!, outletId, id, input);

    sendSuccess(res, { table });
  } catch (error) {
    next(error);
  }
};

export const deactivateTableController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, id } = req.params as { outletId: string; id: string };

    const table = await deactivateTable(req.user!, outletId, id);

    sendSuccess(res, { table });
  } catch (error) {
    next(error);
  }
};

export const regenerateQrTokenController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, id } = req.params as { outletId: string; id: string };

    const table = await regenerateQrToken(req.user!, outletId, id);

    sendSuccess(res, { table });
  } catch (error) {
    next(error);
  }
};

export const getTableQrImageController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, id } = req.params as { outletId: string; id: string };

    const table = await getTable(req.user!, outletId, id);

    // Generate QR code image from the table's QR token
    const qrImage = await QRCode.toBuffer(table.qr_token, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(qrImage);
  } catch (error) {
    next(error);
  }
};
