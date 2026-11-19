import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getEffectiveMenuForOutlet } from '@/services/menu/menu.service';

export interface PublicTableResolution {
  table: {
    id: string;
    label: string;
    seats: number | null;
    qr_token: string;
    status: string;
    is_active: boolean;
  };
  outlet: {
    id: string;
    name: string;
    timezone: string;
    tax_percent: string;
    service_charge_percent: string;
  };
  effective_menu: {
    categories: Array<{
      id: string;
      name: string;
      sort_order: number;
      items: Array<{
        id: string;
        name: string;
        description: string | null;
        base_price: string;
        is_active: boolean;
        image_url: string | null;
        override_price: string | null;
      }>;
    }>;
  };
}

/**
 * Resolves a QR token to table, outlet, and effective menu.
 * This is a public endpoint used by guests scanning QR codes.
 */
export async function resolveQrToken(qrToken: string): Promise<PublicTableResolution> {
  // Find the table by QR token
  const table = await prisma.diningTable.findFirst({
    where: {
      qr_token: qrToken,
      is_active: true,
      outlet: {
        is_active: true,
        deleted_at: null,
      },
    },
    include: {
      outlet: {
        select: {
          id: true,
          name: true,
          timezone: true,
          tax_percent: true,
          service_charge_percent: true,
          is_active: true,
          deleted_at: true,
        },
      },
    },
  });

  if (!table) {
    throw new AppError('NOT_FOUND', 'Invalid QR token', 404);
  }

  // Check if outlet is active and not deleted
  if (!table.outlet.is_active || table.outlet.deleted_at) {
    throw new AppError('NOT_FOUND', 'Outlet not available', 404);
  }

  // Get effective menu for the outlet
  const effectiveMenu = await getEffectiveMenuForOutlet(table.outlet.id);

  return {
    table: {
      id: table.id,
      label: table.label,
      seats: table.seats,
      qr_token: table.qr_token,
      status: table.status,
      is_active: table.is_active,
    },
    outlet: {
      id: table.outlet.id,
      name: table.outlet.name,
      timezone: table.outlet.timezone,
      tax_percent: table.outlet.tax_percent.toString(),
      service_charge_percent: table.outlet.service_charge_percent.toString(),
    },
    effective_menu: effectiveMenu,
  };
}
