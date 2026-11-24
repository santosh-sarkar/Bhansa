import type { RequestHandler } from 'express';

import {
  listOrganizations,
  getOrganizationDetail,
  suspendOrganization,
  reactivateOrganization,
  deleteOrganization,
} from '@/services/super-admin/organization.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const listOrganizationsController: RequestHandler = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      search?: string;
    };

    const result = await listOrganizations({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });

    sendPaginated(res, result.organizations, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrganizationDetailController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const organization = await getOrganizationDetail(id);

    sendSuccess(res, organization);
  } catch (error) {
    next(error);
  }
};

export const suspendOrganizationController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await suspendOrganization(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const reactivateOrganizationController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await reactivateOrganization(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const deleteOrganizationController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await deleteOrganization(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};