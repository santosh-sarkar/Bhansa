import { beforeAll, describe, expect, it } from '@jest/globals';

import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../../helpers/database';
import { audit, writeAuditLog } from '@/services/audit/audit.service';

describe('audit service', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  describe('writeAuditLog', () => {
    it('writes a basic audit log entry with all fields', async () => {
      await writeAuditLog({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        action: 'test.action',
        entity: 'test_entity',
        entityId: '550e8400-e29b-41d4-a716-446655440003',
        meta: { key: 'value', number: 123, nested: { a: 1 } },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'test.action' },
      });

      expect(log).not.toBeNull();
      expect(log!.organization_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(log!.outlet_id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(log!.user_id).toBe('550e8400-e29b-41d4-a716-446655440002');
      expect(log!.action).toBe('test.action');
      expect(log!.entity).toBe('test_entity');
      expect(log!.entity_id).toBe('550e8400-e29b-41d4-a716-446655440003');
      expect(log!.meta).toEqual({ key: 'value', number: 123, nested: { a: 1 } });
      expect(log!.created_at).toBeInstanceOf(Date);
    });

    it('writes an audit log with only required fields', async () => {
      await writeAuditLog({
        action: 'test.minimal',
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'test.minimal' },
      });

      expect(log).not.toBeNull();
      expect(log!.organization_id).toBeNull();
      expect(log!.outlet_id).toBeNull();
      expect(log!.user_id).toBeNull();
      expect(log!.action).toBe('test.minimal');
      expect(log!.entity).toBeNull();
      expect(log!.entity_id).toBeNull();
      expect(log!.meta).toBeNull();
    });

    it('writes an audit log with partial optional fields', async () => {
      await writeAuditLog({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'test.partial',
        entity: 'partial_entity',
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'test.partial' },
      });

      expect(log).not.toBeNull();
      expect(log!.organization_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(log!.outlet_id).toBeNull();
      expect(log!.user_id).toBeNull();
      expect(log!.entity).toBe('partial_entity');
      expect(log!.entity_id).toBeNull();
      expect(log!.meta).toBeNull();
    });
  });

  describe('convenience helpers', () => {
    it('staffInvited writes correct fields', async () => {
      await audit.staffInvited({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: {
          email: 'new@staff.com',
          role: 'waiter',
          outletId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'staff.invited' },
      });

      expect(log).not.toBeNull();
      expect(log!.action).toBe('staff.invited');
      expect(log!.entity).toBe('invitation');
      expect(log!.meta).toEqual({
        email: 'new@staff.com',
        role: 'waiter',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
      });
    });

    it('staffInvitationRevoked writes correct fields', async () => {
      const invitationId = '660e8400-e29b-41d4-a716-446655440003';
      await audit.staffInvitationRevoked({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { invitationId, email: 'revoked@staff.com' },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'staff.invitation_revoked' },
      });

      expect(log).not.toBeNull();
      expect(log!.action).toBe('staff.invitation_revoked');
      expect(log!.entity).toBe('invitation');
      expect(log!.entity_id).toBe(invitationId);
      expect(log!.meta).toEqual({ email: 'revoked@staff.com' });
    });

    it('staffInvitationAccepted writes correct fields', async () => {
      const invitedUserId = '660e8400-e29b-41d4-a716-446655440004';
      await audit.staffInvitationAccepted({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { invitedUserId, role: 'kitchen', outletId: '550e8400-e29b-41d4-a716-446655440001' },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'staff.invitation_accepted' },
      });

      expect(log).not.toBeNull();
      expect(log!.action).toBe('staff.invitation_accepted');
      expect(log!.entity).toBe('user');
      expect(log!.entity_id).toBe(invitedUserId);
      expect(log!.meta).toEqual({
        role: 'kitchen',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
      });
    });

    it('staffRoleChanged writes correct fields', async () => {
      const targetUserId = '660e8400-e29b-41d4-a716-446655440005';
      await audit.staffRoleChanged({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { targetUserId, oldRole: 'waiter', newRole: 'manager' },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'staff.role_changed' },
      });

      expect(log).not.toBeNull();
      expect(log!.action).toBe('staff.role_changed');
      expect(log!.entity).toBe('staff_assignment');
      expect(log!.entity_id).toBe(targetUserId);
      expect(log!.meta).toEqual({ oldRole: 'waiter', newRole: 'manager' });
    });

    it('staffAssignmentsChanged writes correct fields', async () => {
      const targetUserId = '660e8400-e29b-41d4-a716-446655440006';
      await audit.staffAssignmentsChanged({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { targetUserId, outletIds: ['outlet-1', 'outlet-2'] },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'staff.assignments_changed' },
      });

      expect(log).not.toBeNull();
      expect(log!.action).toBe('staff.assignments_changed');
      expect(log!.entity).toBe('staff_assignment');
      expect(log!.entity_id).toBe(targetUserId);
      expect(log!.meta).toEqual({ outletIds: ['outlet-1', 'outlet-2'] });
    });

    it('staffDeactivated writes correct fields', async () => {
      const targetUserId = '660e8400-e29b-41d4-a716-446655440007';
      await audit.staffDeactivated({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { targetUserId },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'staff.deactivated' },
      });

      expect(log).not.toBeNull();
      expect(log!.action).toBe('staff.deactivated');
      expect(log!.entity).toBe('user');
      expect(log!.entity_id).toBe(targetUserId);
      expect(log!.meta).toEqual({});
    });

    it('loginFailed writes correct fields', async () => {
      await audit.loginFailed({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        meta: { email: 'failed@login.com', reason: 'invalid_password', ip: '192.168.1.1' },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'auth.login_failed' },
      });

      expect(log).not.toBeNull();
      expect(log!.action).toBe('auth.login_failed');
      expect(log!.entity).toBe('auth');
      expect(log!.meta).toEqual({
        email: 'failed@login.com',
        reason: 'invalid_password',
        ip: '192.168.1.1',
      });
    });

    it('superAdminAction writes correct fields', async () => {
      await audit.superAdminAction({
        userId: '550e8400-e29b-41d4-a716-446655440002',
        action: 'organization_suspended',
        entity: 'organization',
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        meta: { reason: 'billing' },
      });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'super_admin.organization_suspended' },
      });

      expect(log).not.toBeNull();
      expect(log!.action).toBe('super_admin.organization_suspended');
      expect(log!.entity).toBe('organization');
      expect(log!.entity_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(log!.meta).toEqual({ reason: 'billing' });
    });

    it('menu helpers write correct fields', async () => {
      const itemId = '660e8400-e29b-41d4-a716-446655440008';
      await audit.menuItemCreated({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { itemId, name: 'Pizza', price: '500.00' },
      });

      const created = await prisma.auditLog.findFirst({
        where: { action: 'menu.item_created' },
      });
      expect(created).not.toBeNull();
      expect(created!.entity).toBe('menu_item');
      expect(created!.entity_id).toBe(itemId);
      expect(created!.meta).toEqual({ name: 'Pizza', price: '500.00' });

      await audit.menuItemUpdated({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { itemId, changes: { price: '550.00' } },
      });

      const updated = await prisma.auditLog.findFirst({
        where: { action: 'menu.item_updated' },
      });
      expect(updated).not.toBeNull();
      expect(updated!.entity_id).toBe(itemId);
      expect(updated!.meta).toEqual({ changes: { price: '550.00' } });

      await audit.menuItemDeleted({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { itemId, name: 'Pizza' },
      });

      const deleted = await prisma.auditLog.findFirst({
        where: { action: 'menu.item_deleted' },
      });
      expect(deleted).not.toBeNull();
      expect(deleted!.entity_id).toBe(itemId);
      expect(deleted!.meta).toEqual({ name: 'Pizza' });
    });

    it('outlet override helpers write correct fields', async () => {
      const itemId = '660e8400-e29b-41d4-a716-446655440009';
      await audit.outletOverrideCreated({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { itemId, price: '550.00', isAvailable: true },
      });

      const created = await prisma.auditLog.findFirst({
        where: { action: 'menu.outlet_override_created' },
      });
      expect(created).not.toBeNull();
      expect(created!.outlet_id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(created!.entity_id).toBe(itemId);
      expect(created!.meta).toEqual({ itemId, price: '550.00', isAvailable: true });
    });

    it('payment helpers write correct fields', async () => {
      const billId = '660e8400-e29b-41d4-a716-446655440010';
      await audit.discountApplied({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { billId, amount: '100.00', reason: 'loyalty' },
      });

      const discount = await prisma.auditLog.findFirst({
        where: { action: 'payment.discount_applied' },
      });
      expect(discount).not.toBeNull();
      expect(discount!.entity_id).toBe(billId);
      expect(discount!.meta).toEqual({ amount: '100.00', reason: 'loyalty' });

      await audit.paymentOverride({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { billId, amount: '500.00', method: 'esewa' },
      });

      const override = await prisma.auditLog.findFirst({
        where: { action: 'payment.override' },
      });
      expect(override).not.toBeNull();
      expect(override!.entity_id).toBe(billId);
      expect(override!.meta).toEqual({ amount: '500.00', method: 'esewa' });
    });

    it('subscription helpers write correct fields', async () => {
      const subscriptionId = '660e8400-e29b-41d4-a716-446655440011';
      await audit.planChanged({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { oldPlan: 'trial', newPlan: 'single', subscriptionId },
      });

      const plan = await prisma.auditLog.findFirst({
        where: { action: 'subscription.plan_changed' },
      });
      expect(plan).not.toBeNull();
      expect(plan!.entity_id).toBe(subscriptionId);
      expect(plan!.meta).toEqual({ oldPlan: 'trial', newPlan: 'single' });

      await audit.subscriptionPaymentReceived({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        meta: { subscriptionId, amount: '1000.00', reference: 'ref-123' },
      });

      const payment = await prisma.auditLog.findFirst({
        where: { action: 'subscription.payment_received' },
      });
      expect(payment).not.toBeNull();
      expect(payment!.entity_id).toBe(subscriptionId);
      expect(payment!.meta).toEqual({ amount: '1000.00', reference: 'ref-123' });
    });
  });
});
