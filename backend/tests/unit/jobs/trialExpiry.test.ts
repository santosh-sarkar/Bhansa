import { beforeAll, describe, expect, it, jest } from '@jest/globals';

import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../helpers/database';
import {
  createOrganization,
  createOutlet,
  createUser,
  createStaffAssignment,
} from '../../helpers/factories';
import { createTrialSubscription } from '../../helpers/tenant';
import {
  processTrialExpiry,
  sendReminderEmails,
  moveExpiredTrialsToGrace,
  moveExpiredGraceToSuspended,
} from '@/jobs/trialExpiry.queue';
import { emailService } from '@/services/email/email.service';

jest.mock('@/services/email/email.service', () => ({
  emailService: {
    sendTrialExpiryReminder: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    sendTrialExpired: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    sendTrialSuspended: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
}));

describe('Trial Expiry Job', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  describe('sendReminderEmails', () => {
    it('sends 3-day and 1-day reminders for trial expiring soon', async () => {
      const org = await createOrganization({ name: 'Reminder Test Org' });
      const outlet = await createOutlet(org.id);
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

      // Create subscription expiring in 3 days
      const sub3Days = await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });

      // Create owner user
      const owner = await createUser(org.id, {
        email: 'owner-3days@example.com',
        full_name: 'Owner 3 Days',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: owner.id, roleCode: 'owner' });

      await sendReminderEmails();

      expect(emailService.sendTrialExpiryReminder).toHaveBeenCalledWith(
        owner.email,
        expect.any(String),
        3,
        expect.any(Date),
      );
    });

    it('does not send reminder for trial ending in 2 days (only 3 and 1 day)', async () => {
      const org = await createOrganization({ name: 'No Reminder Org' });
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: (await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } })).id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });

      const owner = await createUser(org.id, {
        email: 'owner-2days@example.com',
        full_name: 'Owner 2 Days',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: owner.id, roleCode: 'owner' });

      await sendReminderEmails();

      // Should not be called for 2 days
      expect(emailService.sendTrialExpiryReminder).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        2,
        expect.any(Date),
      );
    });
  });

  describe('moveExpiredTrialsToGrace', () => {
    it('moves expired trial to grace and sends notification', async () => {
      const org = await createOrganization({ name: 'Expired Trial Org' });
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        },
      });

      const owner = await createUser(org.id, {
        email: 'owner-expired@example.com',
        full_name: 'Owner Expired',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: owner.id, roleCode: 'owner' });

      await moveExpiredTrialsToGrace();

      const sub = await prisma.subscription.findFirst({ where: { organization_id: org.id } });
      expect(sub?.status).toBe('grace');
      expect(sub?.grace_ends_at).not.toBeNull();

      // Check notification sent
      expect(emailService.sendTrialExpired).toHaveBeenCalled();
    });

    it('does not affect active trials', async () => {
      const org = await createOrganization({ name: 'Active Trial Org' });
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      await moveExpiredTrialsToGrace();

      const sub = await prisma.subscription.findFirst({ where: { organization_id: org.id } });
      expect(sub?.status).toBe('trialing');
    });
  });

  describe('moveExpiredGraceToSuspended', () => {
    it('moves expired grace to suspended and sends notification', async () => {
      const org = await createOrganization({ name: 'Expired Grace Org' });
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'grace',
          grace_ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      const owner = await createUser(org.id, {
        email: 'owner-grace-expired@example.com',
        full_name: 'Owner Grace Expired',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: owner.id, roleCode: 'owner' });

      await moveExpiredGraceToSuspended();

      const sub = await prisma.subscription.findFirst({ where: { organization_id: org.id } });
      expect(sub?.status).toBe('suspended');

      // Check notification sent
      expect(emailService.sendTrialSuspended).toHaveBeenCalled();
    });

    it('does not affect active grace periods', async () => {
      const org = await createOrganization({ name: 'Active Grace Org' });
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'grace',
          grace_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await moveExpiredGraceToSuspended();

      const sub = await prisma.subscription.findFirst({ where: { organization_id: org.id } });
      expect(sub?.status).toBe('grace');
    });
  });

  describe('processTrialExpiry (full flow)', () => {
    it('processes all steps: reminders, trial->grace, grace->suspended', async () => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

      // Create organization with trial expiring in 3 days (should get reminder)
      const org3Days = await createOrganization({ name: '3 Days Org' });
      await createOutlet(org3Days.id);
      await prisma.subscription.create({
        data: {
          organization_id: org3Days.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });
      const owner3Days = await createUser(org3Days.id, {
        email: `owner-3d-${Date.now()}@example.com`,
        full_name: 'Owner 3D',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: owner3Days.id, roleCode: 'owner' });

      // Create org with expired trial (should move to grace)
      const orgExpired = await createOrganization({ name: 'Expired Trial' });
      await createOutlet(orgExpired.id);
      await prisma.subscription.create({
        data: {
          organization_id: orgExpired.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });
      const ownerExpired = await createUser(orgExpired.id, {
        email: `owner-expired-${Date.now()}@example.com`,
        full_name: 'Owner Expired',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: ownerExpired.id, roleCode: 'owner' });

      // Create org with expired grace (should move to suspended)
      const orgGrace = await createOrganization({ name: 'Expired Grace' });
      await createOutlet(orgGrace.id);
      await prisma.subscription.create({
        data: {
          organization_id: orgGrace.id,
          plan_id: plan.id,
          status: 'grace',
          grace_ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });
      const ownerGrace = await createUser(orgGrace.id, {
        email: `owner-grace-${Date.now()}@example.com`,
        full_name: 'Owner Grace',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: ownerGrace.id, roleCode: 'owner' });

      await processTrialExpiry();

      // Check 3-day reminder sent
      expect(emailService.sendTrialExpiryReminder).toHaveBeenCalled();

      // Check expired trial moved to grace
      const subExpired = await prisma.subscription.findFirst({
        where: { organization_id: orgExpired.id },
      });
      expect(subExpired?.status).toBe('grace');

      // Check expired grace moved to suspended
      const subGrace = await prisma.subscription.findFirst({
        where: { organization_id: orgGrace.id },
      });
      expect(subGrace?.status).toBe('suspended');

      // Check notifications sent
      expect(emailService.sendTrialExpired).toHaveBeenCalled();
      expect(emailService.sendTrialSuspended).toHaveBeenCalled();
    });
  });
});
