import type { RequestHandler } from 'express';

import {
  listLeads,
  getLeadById,
  markLeadHandled,
} from '@/services/super-admin/lead.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const listLeadsController: RequestHandler = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const handled = req.query.handled === 'true' ? true : req.query.handled === 'false' ? false : undefined;

    const result = await listLeads({ page, limit, handled });
    sendPaginated(res, result.leads, { page, limit, total: result.total });
  } catch (error) {
    next(error);
  }
};

export const getLeadController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const lead = await getLeadById(id);
    sendSuccess(res, lead);
  } catch (error) {
    next(error);
  }
};

export const markLeadHandledController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const lead = await markLeadHandled(id);
    sendSuccess(res, lead);
  } catch (error) {
    next(error);
  }
};