import { beforeAll, describe, expect, it } from '@jest/globals';

import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../../helpers/database';
import {
  canAddMenuItem,
  canAddStaff,
  canCreateOutlet,
  getLimits,
} from '@/services/plans/plan.service';

describe('plan service', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  describe('getLimits', () => {
    it('returns plan base limits when subscription has no overrides', async () => {
      // Create an organization with a plan and a subscription (trialing)
      const org = await prisma.organization.create({
        data: {
          name: 'Limit Test Org',
          slug: `limit-test-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      const limits = await getLimits(org.id);

      expect(limits.maxOutlets).toBe(plan.max_outlets);
      expect(limits.maxStaff).toBe(plan.max_staff);
      expect(limits.maxMenuItems).toBe(plan.max_menu_items);
      expect(limits.multiOutletEnabled).toBe(plan.multi_outlet_enabled);
      expect(limits.features).toEqual(plan.features ?? {});
    });

    it('merges subscription overrides over plan base limits', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Override Test Org',
          slug: `override-test-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'active',
          max_outlets_override: 10,
          max_staff_override: 50,
          max_menu_items_override: 500,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const limits = await getLimits(org.id);

      expect(limits.maxOutlets).toBe(10);
      expect(limits.maxStaff).toBe(50);
      expect(limits.maxMenuItems).toBe(500);
      expect(limits.multiOutletEnabled).toBe(plan.multi_outlet_enabled);
    });

    it('returns restrictive defaults when no active subscription', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'No Sub Org',
          slug: `no-sub-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const limits = await getLimits(org.id);

      expect(limits.maxOutlets).toBe(0);
      expect(limits.maxStaff).toBe(0);
      expect(limits.maxMenuItems).toBe(0);
      expect(limits.multiOutletEnabled).toBe(false);
    });

    it('ignores suspended/cancelled subscriptions', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Suspended Org',
          slug: `suspended-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'suspended',
          max_outlets_override: 99,
        },
      });

      const limits = await getLimits(org.id);

      expect(limits.maxOutlets).toBe(0);
      expect(limits.maxStaff).toBe(0);
      expect(limits.maxMenuItems).toBe(0);
    });

    it('uses the most recent subscription when previous is cancelled', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Multi Sub Org',
          slug: `multi-sub-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      // Create first subscription and cancel it
      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'cancelled',
          max_outlets_override: 5,
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      // Create second active subscription
      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'active',
          max_outlets_override: 20,
          created_at: new Date(),
        },
      });

      const limits = await getLimits(org.id);

      expect(limits.maxOutlets).toBe(20);
    });
  });

  describe('canCreateOutlet', () => {
    it('allows creating outlet when under limit', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Outlet Limit Test',
          slug: `outlet-limit-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      const result = await canCreateOutlet(org.id);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(plan.max_outlets);
      expect(result.current).toBe(0);
    });

    it('rejects when at limit', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'At Limit Org',
          slug: `at-limit-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      // Create outlets up to the limit
      for (let i = 0; i < plan.max_outlets; i++) {
        await prisma.outlet.create({
          data: {
            organization_id: org.id,
            name: `Outlet ${i + 1}`,
          },
        });
      }

      const result = await canCreateOutlet(org.id);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(plan.max_outlets);
      expect(result.limit).toBe(plan.max_outlets);
    });

    it('ignores soft-deleted outlets in count', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Deleted Outlet Org',
          slug: `deleted-outlet-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.outlet.create({
        data: {
          organization_id: org.id,
          name: 'Active Outlet',
        },
      });

      const deleted = await prisma.outlet.create({
        data: {
          organization_id: org.id,
          name: 'Deleted Outlet',
        },
      });

      await prisma.outlet.update({
        where: { id: deleted.id },
        data: { deleted_at: new Date() },
      });

      const result = await canCreateOutlet(org.id);

      expect(result.current).toBe(1); // Only active outlet counted
      // With max_outlets=1 and 1 active outlet, we're at the limit so can't create another
      expect(result.allowed).toBe(false);
    });
  });

  describe('canAddStaff', () => {
    it('allows adding staff when under limit', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Staff Limit Test',
          slug: `staff-limit-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      const result = await canAddStaff(org.id);

      console.log('DEBUG canAddStaff result:', JSON.stringify(result, null, 2));

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(plan.max_staff);
      expect(result.current).toBe(0);
    });

    it('rejects when at staff limit', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Staff At Limit Org',
          slug: `staff-at-limit-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      // Use subscription override to set a limit of 2
      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          max_staff_override: 2,
        },
      });

      const role = await prisma.role.findUniqueOrThrow({ where: { code: 'waiter' } });

      // Create staff up to the limit (2)
      for (let i = 0; i < 2; i++) {
        const user = await prisma.user.create({
          data: {
            organization_id: org.id,
            email: `staff-${i}-${Date.now()}@example.com`,
            password_hash: 'hash',
            full_name: `Staff ${i}`,
            is_active: true,
            email_verified_at: new Date(),
          },
        });

        await prisma.staffAssignment.create({
          data: { user_id: user.id, role_id: role.id },
        });
      }

      const result = await canAddStaff(org.id);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(2);
    });

    it('only counts active staff with assignments', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Active Staff Org',
          slug: `active-staff-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      const role = await prisma.role.findUniqueOrThrow({ where: { code: 'waiter' } });

      // Active staff with assignment
      const activeUser = await prisma.user.create({
        data: {
          organization_id: org.id,
          email: `active-${Date.now()}@example.com`,
          password_hash: 'hash',
          full_name: 'Active Staff',
          is_active: true,
          email_verified_at: new Date(),
        },
      });
      await prisma.staffAssignment.create({
        data: { user_id: activeUser.id, role_id: role.id },
      });

      // Inactive staff
      const inactiveUser = await prisma.user.create({
        data: {
          organization_id: org.id,
          email: `inactive-${Date.now()}@example.com`,
          password_hash: 'hash',
          full_name: 'Inactive Staff',
          is_active: false,
          email_verified_at: new Date(),
        },
      });
      await prisma.staffAssignment.create({
        data: { user_id: inactiveUser.id, role_id: role.id },
      });

      // User without assignment
      await prisma.user.create({
        data: {
          organization_id: org.id,
          email: `no-assign-${Date.now()}@example.com`,
          password_hash: 'hash',
          full_name: 'No Assignment',
          is_active: true,
          email_verified_at: new Date(),
        },
      });

      const result = await canAddStaff(org.id);

      expect(result.current).toBe(1); // Only active staff with assignment counted
    });
  });

  describe('canAddMenuItem', () => {
    it('allows adding menu item when under limit', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Menu Limit Test',
          slug: `menu-limit-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      const category = await prisma.menuCategory.create({
        data: { organization_id: org.id, name: 'Test Category' },
      });

      const result = await canAddMenuItem(org.id);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(plan.max_menu_items);
      expect(result.current).toBe(0);
    });

    it('rejects when at menu item limit', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Menu At Limit Org',
          slug: `menu-at-limit-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      // Use subscription override to set a limit of 2
      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          max_menu_items_override: 2,
        },
      });

      const category = await prisma.menuCategory.create({
        data: { organization_id: org.id, name: 'Test Category' },
      });

      // Create menu items up to the limit (2)
      for (let i = 0; i < 2; i++) {
        await prisma.menuItem.create({
          data: {
            organization_id: org.id,
            category_id: category.id,
            name: `Item ${i + 1}`,
            base_price: '100.00',
            is_active: true,
          },
        });
      }

      const result = await canAddMenuItem(org.id);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(2);
    });

    it('ignores soft-deleted menu items in count', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Deleted Menu Item Org',
          slug: `deleted-menu-${Date.now()}`,
          currency: 'NPR',
        },
      });

      const plan = await prisma.plan.findUniqueOrThrow({
        where: { code: 'single' },
      });

      await prisma.subscription.create({
        data: {
          organization_id: org.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      const category = await prisma.menuCategory.create({
        data: { organization_id: org.id, name: 'Test Category' },
      });

      await prisma.menuItem.create({
        data: {
          organization_id: org.id,
          category_id: category.id,
          name: 'Active Item',
          base_price: '100.00',
          is_active: true,
        },
      });

      const deleted = await prisma.menuItem.create({
        data: {
          organization_id: org.id,
          category_id: category.id,
          name: 'Deleted Item',
          base_price: '200.00',
          is_active: true,
        },
      });

      await prisma.menuItem.update({
        where: { id: deleted.id },
        data: { deleted_at: new Date() },
      });

      const result = await canAddMenuItem(org.id);

      expect(result.current).toBe(1); // Only active item counted
      expect(result.allowed).toBe(true);
    });
  });
});
