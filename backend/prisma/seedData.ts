import type { Prisma, PrismaClient } from '@prisma/client';

type SeedClient = PrismaClient | Prisma.TransactionClient;

export const ROLES = [
  { code: 'owner', name: 'Owner' },
  { code: 'manager', name: 'Manager' },
  { code: 'waiter', name: 'Waiter' },
  { code: 'kitchen', name: 'Kitchen' },
] as const;

export const PERMISSIONS = [
  { code: 'billing.manage', description: 'Manage billing and subscription' },
  { code: 'staff.manage', description: 'Invite and manage staff' },
  { code: 'menu.edit', description: 'Edit menu, prices, categories' },
  { code: 'tables.manage', description: 'Manage tables and QR codes' },
  { code: 'outlets.manage', description: 'Create and deactivate outlets' },
  { code: 'order.create', description: 'Place or edit orders' },
  { code: 'order.update_status', description: 'Update order status' },
  { code: 'order.cancel', description: 'Cancel orders' },
  { code: 'payment.record', description: 'Generate bills and record payments' },
  { code: 'analytics.view', description: 'View analytics and reports' },
  { code: 'inventory.manage', description: 'Manage ingredients, recipes, thresholds' },
  { code: 'inventory.restock', description: 'Record restocks' },
  { code: 'inventory.adjust', description: 'Adjust stock counts' },
  { code: 'inventory.wastage', description: 'Log wastage' },
  { code: 'inventory.view', description: 'View inventory and alerts' },
  { code: 'item.mark_unavailable', description: 'Mark item or ingredient out of stock' },
] as const;

const ALL_PERMISSION_CODES = PERMISSIONS.map((permission) => permission.code);

// Mirrors the PRD permission matrix; D-045 gives Waiter order.cancel.
export const ROLE_PERMISSION_CODES: Record<string, readonly string[]> = {
  owner: ALL_PERMISSION_CODES,
  manager: ALL_PERMISSION_CODES.filter((code) => code !== 'billing.manage'),
  waiter: ['order.create', 'order.update_status', 'order.cancel', 'payment.record'],
  kitchen: [
    'order.update_status',
    'inventory.adjust',
    'inventory.wastage',
    'inventory.view',
    'item.mark_unavailable',
  ],
};

export type PlanSeed = {
  code: string;
  name: string;
  price_monthly: number;
  max_outlets: number;
  max_staff: number | null;
  max_menu_items: number | null;
  multi_outlet_enabled: boolean;
  features: Record<string, boolean>;
  is_public: boolean;
};

// Prices stay 0 until pricing is decided (D-043); currency defaults to NPR.
export const PLANS: PlanSeed[] = [
  {
    code: 'trial',
    name: 'Free Trial (14 days)',
    price_monthly: 0,
    max_outlets: 1,
    max_staff: null,
    max_menu_items: null,
    multi_outlet_enabled: false,
    features: { inventory: true, analytics: true },
    is_public: true,
  },
  {
    code: 'single',
    name: 'Single Outlet',
    price_monthly: 0,
    max_outlets: 1,
    max_staff: null,
    max_menu_items: null,
    multi_outlet_enabled: false,
    features: { inventory: true, analytics: true },
    is_public: true,
  },
  {
    code: 'custom',
    name: 'Custom / Multi-Outlet',
    price_monthly: 0,
    max_outlets: 1,
    max_staff: null,
    max_menu_items: null,
    multi_outlet_enabled: true,
    features: { inventory: true, analytics: true, consolidated_dashboard: true },
    is_public: true,
  },
];

export async function seedReferenceData(tx: SeedClient): Promise<void> {
  for (const role of ROLES) {
    await tx.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: { code: role.code, name: role.name },
    });
  }

  for (const permission of PERMISSIONS) {
    await tx.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: {
        code: permission.code,
        description: permission.description,
      },
    });
  }

  const roles = await tx.role.findMany({
    where: { code: { in: ROLES.map((role) => role.code) } },
  });
  const roleIdByCode = new Map(roles.map((role) => [role.code, role.id]));

  const permissions = await tx.permission.findMany({
    where: { code: { in: [...ALL_PERMISSION_CODES] } },
  });
  const permissionIdByCode = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  for (const role of ROLES) {
    const roleId = roleIdByCode.get(role.code);

    if (roleId === undefined) {
      throw new Error(`Role not found after upsert: ${role.code}`);
    }

    const data = (ROLE_PERMISSION_CODES[role.code] ?? []).map((code) => {
      const permissionId = permissionIdByCode.get(code);

      if (permissionId === undefined) {
        throw new Error(`Permission not found after upsert: ${code}`);
      }

      return { role_id: roleId, permission_id: permissionId };
    });

    await tx.rolePermission.deleteMany({ where: { role_id: roleId } });

    if (data.length > 0) {
      await tx.rolePermission.createMany({ data });
    }
  }

  for (const plan of PLANS) {
    const { code, ...values } = plan;

    await tx.plan.upsert({
      where: { code },
      update: values,
      create: plan,
    });
  }
}
