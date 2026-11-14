import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export interface AuditLogParams {
  organizationId?: string | null;
  outletId?: string | null;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue | typeof Prisma.DbNull | typeof Prisma.JsonNull | null;
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organization_id: params.organizationId ?? null,
      outlet_id: params.outletId ?? null,
      user_id: params.userId ?? null,
      action: params.action,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
      meta: params.meta ?? Prisma.DbNull,
    },
  });
}

/**
 * Convenience helpers for common audit actions.
 * All write directly; no return value needed (fire-and-forget pattern
 * suitable for append-only logs).
 */
export const audit = {
  staffInvited: (params: {
    organizationId: string;
    outletId?: string | null;
    userId: string;
    meta: { email: string; role: string; outletId?: string | null };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId ?? null,
      userId: params.userId,
      action: 'staff.invited',
      entity: 'invitation',
      meta: params.meta,
    }),

  staffInvitationRevoked: (params: {
    organizationId: string;
    outletId?: string | null;
    userId: string;
    meta: { invitationId: string; email: string };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId ?? null,
      userId: params.userId,
      action: 'staff.invitation_revoked',
      entity: 'invitation',
      entityId: params.meta.invitationId,
      meta: { email: params.meta.email },
    }),

  staffInvitationAccepted: (params: {
    organizationId: string;
    outletId?: string | null;
    userId: string;
    meta: { invitedUserId: string; role: string; outletId?: string | null };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId ?? null,
      userId: params.userId,
      action: 'staff.invitation_accepted',
      entity: 'user',
      entityId: params.meta.invitedUserId,
      meta: { role: params.meta.role, outletId: params.meta.outletId },
    }),

  staffRoleChanged: (params: {
    organizationId: string;
    outletId?: string | null;
    userId: string;
    meta: { targetUserId: string; oldRole: string; newRole: string };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId ?? null,
      userId: params.userId,
      action: 'staff.role_changed',
      entity: 'staff_assignment',
      entityId: params.meta.targetUserId,
      meta: { oldRole: params.meta.oldRole, newRole: params.meta.newRole },
    }),

  staffAssignmentsChanged: (params: {
    organizationId: string;
    outletId?: string | null;
    userId: string;
    meta: { targetUserId: string; outletIds: string[] };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId ?? null,
      userId: params.userId,
      action: 'staff.assignments_changed',
      entity: 'staff_assignment',
      entityId: params.meta.targetUserId,
      meta: { outletIds: params.meta.outletIds },
    }),

  staffDeactivated: (params: {
    organizationId: string;
    outletId?: string | null;
    userId: string;
    meta: { targetUserId: string };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId ?? null,
      userId: params.userId,
      action: 'staff.deactivated',
      entity: 'user',
      entityId: params.meta.targetUserId,
      meta: {},
    }),

  menuItemCreated: (params: {
    organizationId: string;
    userId: string;
    meta: { itemId: string; name: string; price: string };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      userId: params.userId,
      action: 'menu.item_created',
      entity: 'menu_item',
      entityId: params.meta.itemId,
      meta: { name: params.meta.name, price: params.meta.price },
    }),

  menuItemUpdated: (params: {
    organizationId: string;
    userId: string;
    meta: { itemId: string; changes: Record<string, unknown> };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      userId: params.userId,
      action: 'menu.item_updated',
      entity: 'menu_item',
      entityId: params.meta.itemId,
      meta: { changes: params.meta.changes } as Prisma.InputJsonValue,
    }),

  menuItemDeleted: (params: {
    organizationId: string;
    userId: string;
    meta: { itemId: string; name: string };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      userId: params.userId,
      action: 'menu.item_deleted',
      entity: 'menu_item',
      entityId: params.meta.itemId,
      meta: { name: params.meta.name },
    }),

  outletOverrideCreated: (params: {
    organizationId: string;
    outletId: string;
    userId: string;
    meta: { itemId: string; price?: string; isAvailable?: boolean };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId,
      userId: params.userId,
      action: 'menu.outlet_override_created',
      entity: 'menu_item_outlet_override',
      entityId: params.meta.itemId,
      meta: params.meta,
    }),

  outletOverrideUpdated: (params: {
    organizationId: string;
    outletId: string;
    userId: string;
    meta: { itemId: string; changes: Record<string, unknown> };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId,
      userId: params.userId,
      action: 'menu.outlet_override_updated',
      entity: 'menu_item_outlet_override',
      entityId: params.meta.itemId,
      meta: { changes: params.meta.changes } as Prisma.InputJsonValue,
    }),

  discountApplied: (params: {
    organizationId: string;
    outletId: string;
    userId: string;
    meta: { billId: string; amount: string; reason?: string | null };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId,
      userId: params.userId,
      action: 'payment.discount_applied',
      entity: 'bill',
      entityId: params.meta.billId,
      meta: { amount: params.meta.amount, reason: params.meta.reason },
    }),

  paymentOverride: (params: {
    organizationId: string;
    outletId: string;
    userId: string;
    meta: { billId: string; amount: string; method: string };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      outletId: params.outletId,
      userId: params.userId,
      action: 'payment.override',
      entity: 'bill',
      entityId: params.meta.billId,
      meta: { amount: params.meta.amount, method: params.meta.method },
    }),

  planChanged: (params: {
    organizationId: string;
    userId: string;
    meta: { oldPlan: string; newPlan: string; subscriptionId: string };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      userId: params.userId,
      action: 'subscription.plan_changed',
      entity: 'subscription',
      entityId: params.meta.subscriptionId,
      meta: { oldPlan: params.meta.oldPlan, newPlan: params.meta.newPlan },
    }),

  subscriptionPaymentReceived: (params: {
    organizationId: string;
    userId: string;
    meta: { subscriptionId: string; amount: string; reference: string };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId,
      userId: params.userId,
      action: 'subscription.payment_received',
      entity: 'subscription',
      entityId: params.meta.subscriptionId,
      meta: { amount: params.meta.amount, reference: params.meta.reference },
    }),

  loginFailed: (params: {
    organizationId?: string | null;
    meta: { email: string; reason: string; ip?: string | null };
  }) =>
    writeAuditLog({
      organizationId: params.organizationId ?? null,
      action: 'auth.login_failed',
      entity: 'auth',
      meta: { email: params.meta.email, reason: params.meta.reason, ip: params.meta.ip },
    }),

  superAdminAction: (params: {
    userId: string;
    action: string;
    entity: string;
    entityId?: string | null;
    meta?: Prisma.InputJsonValue | null;
  }) =>
    writeAuditLog({
      userId: params.userId,
      action: `super_admin.${params.action}`,
      entity: params.entity,
      entityId: params.entityId ?? null,
      meta: params.meta ?? Prisma.DbNull,
    }),
};
