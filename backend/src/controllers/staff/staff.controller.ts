import type { RequestHandler } from 'express';

import {
  changeStaffAssignments,
  changeStaffRole,
  deactivateStaff,
  listStaff,
} from '@/services/staff/staff.service';
import type {
  SetStaffAssignmentsInput,
  ChangeStaffRoleInput,
  ListStaffQuery,
} from '@/validations/staff/staff.schema';
import { sendSuccess } from '@/utils/response';

export const listStaffController: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListStaffQuery;

    const { staff, total } = await listStaff({
      actor: req.user!,
      page: query.page,
      limit: query.limit,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.role !== undefined ? { roleCode: query.role } : {}),
    });

    sendSuccess(res, { staff }, { meta: { page: query.page, limit: query.limit, total } });
  } catch (error) {
    next(error);
  }
};

export const changeStaffRoleController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as ChangeStaffRoleInput;

    const staff = await changeStaffRole({
      actor: req.user!,
      currentOutlet: req.outlet!,
      staffId: id,
      roleCode: body.role,
    });

    sendSuccess(res, { staff });
  } catch (error) {
    next(error);
  }
};

export const changeStaffAssignmentsController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as SetStaffAssignmentsInput;

    const staff = await changeStaffAssignments({
      actor: req.user!,
      staffId: id,
      outletIds: body.outlet_ids,
    });

    sendSuccess(res, { staff });
  } catch (error) {
    next(error);
  }
};

export const deactivateStaffController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    await deactivateStaff({ actor: req.user!, staffId: id });

    sendSuccess(res, { deactivated: true });
  } catch (error) {
    next(error);
  }
};
