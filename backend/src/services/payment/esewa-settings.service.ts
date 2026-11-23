import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';
import { decrypt, encrypt } from '@/utils/encryption';

export interface EsewaSettingsDetail {
  outlet_id: string;
  provider: string;
  product_code: string;
  secret_key_encrypted: string; // Returned encrypted for security
  is_test_mode: boolean;
  is_enabled: boolean;
  updated_at: Date;
}

export interface EsewaSettingsInput {
  product_code: string;
  secret_key: string;
  is_test_mode?: boolean;
  is_enabled?: boolean;
}

/**
 * Gets eSewa settings for an outlet.
 * Returns encrypted secret key for security.
 */
export async function getEsewaSettings(actor: StaffActor, outletId: string): Promise<EsewaSettingsDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: {
      id: true,
      organization_id: true,
      paymentSettings: true,
    },
  });

  if (!outlet) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Check tenant isolation
  if (outlet.organization_id !== actor.organization_id) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Check if user has access to this outlet
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
  }

  if (!outlet.paymentSettings) {
    throw new AppError('NOT_FOUND', 'eSewa settings not configured for this outlet', 404);
  }

  return {
    outlet_id: outlet.paymentSettings.outlet_id,
    provider: outlet.paymentSettings.provider,
    product_code: outlet.paymentSettings.product_code,
    secret_key_encrypted: outlet.paymentSettings.secret_key_encrypted,
    is_test_mode: outlet.paymentSettings.is_test_mode,
    is_enabled: outlet.paymentSettings.is_enabled,
    updated_at: outlet.paymentSettings.updated_at,
  };
}

/**
 * Creates or updates eSewa settings for an outlet.
 * Encrypts the secret key before storing.
 * Requires billing.manage permission.
 */
export async function upsertEsewaSettings(
  actor: StaffActor,
  outletId: string,
  input: EsewaSettingsInput,
): Promise<EsewaSettingsDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Check if user has billing.manage permission
  const hasBillingManage = await prisma.staffAssignment.findFirst({
    where: {
      user_id: actor.id,
      role: { rolePermissions: { some: { permission: { code: 'billing.manage' } } } },
      OR: [{ outlet_id: null }, { outlet_id: outletId }],
    },
    select: { id: true },
  });

  if (!hasBillingManage) {
    throw new AppError('FORBIDDEN', 'Requires billing.manage permission', 403);
  }

  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: {
      id: true,
      organization_id: true,
    },
  });

  if (!outlet) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Check tenant isolation
  if (outlet.organization_id !== actor.organization_id) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Check if user has access to this outlet
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
  }

  // Encrypt the secret key
  const secretKeyEncrypted = encrypt(input.secret_key);

  const settings = await prisma.outletPaymentSetting.upsert({
    where: { outlet_id: outletId },
    create: {
      outlet_id: outletId,
      provider: 'esewa',
      product_code: input.product_code,
      secret_key_encrypted: secretKeyEncrypted,
      is_test_mode: input.is_test_mode ?? true,
      is_enabled: input.is_enabled ?? false,
    },
    update: {
      product_code: input.product_code,
      secret_key_encrypted: secretKeyEncrypted,
      is_test_mode: input.is_test_mode ?? true,
      is_enabled: input.is_enabled ?? false,
      updated_at: new Date(),
    },
  });

  return {
    outlet_id: settings.outlet_id,
    provider: settings.provider,
    product_code: settings.product_code,
    secret_key_encrypted: settings.secret_key_encrypted,
    is_test_mode: settings.is_test_mode,
    is_enabled: settings.is_enabled,
    updated_at: settings.updated_at,
  };
}

/**
 * Deletes eSewa settings for an outlet.
 * Requires billing.manage permission.
 */
export async function deleteEsewaSettings(actor: StaffActor, outletId: string): Promise<{ success: boolean }> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Check if user has billing.manage permission
  const hasBillingManage = await prisma.staffAssignment.findFirst({
    where: {
      user_id: actor.id,
      role: { rolePermissions: { some: { permission: { code: 'billing.manage' } } } },
      OR: [{ outlet_id: null }, { outlet_id: outletId }],
    },
    select: { id: true },
  });

  if (!hasBillingManage) {
    throw new AppError('FORBIDDEN', 'Requires billing.manage permission', 403);
  }

  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: {
      id: true,
      organization_id: true,
    },
  });

  if (!outlet) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Check tenant isolation
  if (outlet.organization_id !== actor.organization_id) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Check if user has access to this outlet
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
  }

  await prisma.outletPaymentSetting.delete({
    where: { outlet_id: outletId },
  });

  return { success: true };
}

/**
 * Gets decrypted secret key for internal use (e.g., payment initiation).
 * Only for internal service use, not exposed via API.
 */
export async function getDecryptedEsewaSecret(outletId: string): Promise<{
  product_code: string;
  secret_key: string;
  is_test_mode: boolean;
  is_enabled: boolean;
} | null> {
  const settings = await prisma.outletPaymentSetting.findUnique({
    where: { outlet_id: outletId },
  });

  if (!settings || !settings.is_enabled) {
    return null;
  }

  const secretKey = decrypt(settings.secret_key_encrypted);

  return {
    product_code: settings.product_code,
    secret_key: secretKey,
    is_test_mode: settings.is_test_mode,
    is_enabled: settings.is_enabled,
  };
}