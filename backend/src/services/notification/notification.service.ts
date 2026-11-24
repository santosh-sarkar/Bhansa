import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';

export interface NotificationDetail {
  id: string;
  outlet_id: string | null;
  user_id: string | null;
  type: string;
  payload: Record<string, string>;
  read_at: Date | null;
  created_at: Date;
  outlet: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export interface CreateNotificationInput {
  outlet_id?: string;
  user_id?: string;
  type: string;
  payload?: Record<string, string>;
}

/**
 * Creates a new notification.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationDetail> {
  const notification = await prisma.notification.create({
    data: {
      outlet_id: input.outlet_id ?? null,
      user_id: input.user_id ?? null,
      type: input.type,
      payload: input.payload ?? {},
    },
    include: {
      outlet: { select: { id: true, name: true } },
      user: { select: { id: true, full_name: true, email: true } },
    },
  });

  return {
    id: notification.id,
    outlet_id: notification.outlet_id,
    user_id: notification.user_id,
    type: notification.type,
    payload: notification.payload as Record<string, string>,
    read_at: notification.read_at,
    created_at: notification.created_at,
    outlet: notification.outlet,
    user: notification.user,
  };
}

/**
 * Creates a notification for all managers/owners of an outlet.
 */
export async function createOutletNotification(
  outletId: string,
  type: string,
  payload: Record<string, string>,
): Promise<NotificationDetail[]> {
  // Find all users with assignments to this outlet who are owners/managers
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      outlet_id: outletId,
      role: {
        code: { in: ['owner', 'manager'] },
      },
    },
    include: { user: true },
  });

  const notifications = await Promise.all(
    assignments.map((assignment) =>
      prisma.notification.create({
        data: {
          outlet_id: outletId,
          user_id: assignment.user_id,
          type,
          payload,
        },
        include: {
          outlet: { select: { id: true, name: true } },
          user: { select: { id: true, full_name: true, email: true } },
        },
      }),
    ),
  );

  return notifications.map((n) => ({
    id: n.id,
    outlet_id: n.outlet_id,
    user_id: n.user_id,
    type: n.type,
    payload: n.payload as Record<string, string>,
    read_at: n.read_at,
    created_at: n.created_at,
    outlet: n.outlet,
    user: n.user,
  }));
}

/**
 * Creates a notification for all super admins.
 */
export async function createSuperAdminNotification(
  type: string,
  payload: Record<string, string>,
): Promise<NotificationDetail[]> {
  const superAdmins = await prisma.user.findMany({
    where: { is_super_admin: true, is_active: true },
  });

  const notifications = await Promise.all(
    superAdmins.map((user) =>
      prisma.notification.create({
        data: {
          user_id: user.id,
          type,
          payload,
        },
        include: {
          outlet: { select: { id: true, name: true } },
          user: { select: { id: true, full_name: true, email: true } },
        },
      }),
    ),
  );

  return notifications.map((n) => ({
    id: n.id,
    outlet_id: n.outlet_id,
    user_id: n.user_id,
    type: n.type,
    payload: n.payload as Record<string, string>,
    read_at: n.read_at,
    created_at: n.created_at,
    outlet: n.outlet,
    user: n.user,
  }));
}

/**
 * Lists notifications for the current user with filters.
 */
export async function listNotifications(
  actor: StaffActor,
  filters: {
    page: number;
    limit: number;
    read?: boolean;
    type?: string;
  },
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  await getAccessibleOutletIds(actor);

  const where: Prisma.NotificationWhereInput = {
    user_id: actor.id,
  };

  if (filters.read !== undefined) {
    where.read_at = filters.read ? { not: null } : null;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true } },
        user: { select: { id: true, full_name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      outlet_id: n.outlet_id,
      user_id: n.user_id,
      type: n.type,
      payload: n.payload as Record<string, string>,
      read_at: n.read_at,
      created_at: n.created_at,
      outlet: n.outlet,
      user: n.user,
    })),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationRead(
  actor: StaffActor,
  notificationId: string,
): Promise<NotificationDetail> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError('NOT_FOUND', 'Notification not found', 404);
  }

  // Check if user owns this notification or is super admin
  if (notification.user_id !== actor.id && !actor.is_super_admin) {
    throw new AppError('FORBIDDEN', 'No access to this notification', 403);
  }

  if (notification.read_at) {
    return {
      id: notification.id,
      outlet_id: notification.outlet_id,
      user_id: notification.user_id,
      type: notification.type,
      payload: notification.payload as Record<string, string>,
      read_at: notification.read_at,
      created_at: notification.created_at,
      outlet: null,
      user: null,
    };
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read_at: new Date() },
    include: {
      outlet: { select: { id: true, name: true } },
      user: { select: { id: true, full_name: true, email: true } },
    },
  });

  return {
    id: updated.id,
    outlet_id: updated.outlet_id,
    user_id: updated.user_id,
    type: updated.type,
    payload: updated.payload as Record<string, string>,
    read_at: updated.read_at,
    created_at: updated.created_at,
    outlet: updated.outlet,
    user: updated.user,
  };
}

/**
 * Marks all unread notifications as read for the current user.
 */
export async function markAllNotificationsRead(
  actor: StaffActor,
): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      user_id: actor.id,
      read_at: null,
    },
    data: { read_at: new Date() },
  });

  return { count: result.count };
}

/**
 * Gets unread notification count for the current user.
 */
export async function getUnreadCount(actor: StaffActor): Promise<{ count: number }> {
  const count = await prisma.notification.count({
    where: {
      user_id: actor.id,
      read_at: null,
    },
  });

  return { count };
}