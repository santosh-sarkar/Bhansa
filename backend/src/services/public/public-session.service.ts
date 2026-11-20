import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { generateSecureToken, hashToken } from '@/utils/token';
import { GUEST_COOKIE_NAME, setGuestCookie, clearGuestCookie } from '@/utils/cookies';

export interface PublicSessionStartInput {
  qrToken: string;
}

export interface PublicSessionResult {
  session: {
    id: string;
    outlet_id: string;
    table_id: string;
    status: string;
    opened_at: Date;
  };
  table: {
    id: string;
    label: string;
    seats: number | null;
  };
  outlet: {
    id: string;
    name: string;
  };
}

export interface CurrentSessionResult {
  session: {
    id: string;
    outlet_id: string;
    table_id: string;
    status: string;
    opened_at: Date;
  };
  table: {
    id: string;
    label: string;
    seats: number | null;
  };
  outlet: {
    id: string;
    name: string;
    tax_percent: string;
    service_charge_percent: string;
  };
  orders: Array<{
    id: string;
    order_number: number;
    status: string;
    subtotal: string;
    tax_amount: string;
    discount_amount: string;
    total: string;
    created_at: Date;
    items: Array<{
      id: string;
      menu_item_id: string;
      name: string;
      quantity: number;
      unit_price: string;
      total_price: string;
      status: string;
    }>;
  }>;
}

/**
 * Starts a new table session or joins an existing open session for the given QR token.
 * Sets a guest token cookie for session identification.
 */
export async function startOrJoinTableSession(
  input: PublicSessionStartInput,
  res: Response,
): Promise<PublicSessionResult> {
  // Resolve the QR token to get table and outlet
  const table = await prisma.diningTable.findFirst({
    where: {
      qr_token: input.qrToken,
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
          is_active: true,
          deleted_at: true,
        },
      },
    },
  });

  if (!table) {
    throw new AppError('NOT_FOUND', 'Invalid QR token', 404);
  }

  if (!table.outlet.is_active || table.outlet.deleted_at) {
    throw new AppError('NOT_FOUND', 'Outlet not available', 404);
  }

  // Check if there's already an open session for this table
  const existingSession = await prisma.tableSession.findFirst({
    where: {
      table_id: table.id,
      status: 'open',
    },
    select: {
      id: true,
      outlet_id: true,
      table_id: true,
      status: true,
      opened_at: true,
      guest_token: true,
    },
  });

  if (existingSession) {
    // Join existing session - no need to update guest_token if already set
    return {
      session: {
        id: existingSession.id,
        outlet_id: existingSession.outlet_id,
        table_id: existingSession.table_id,
        status: existingSession.status,
        opened_at: existingSession.opened_at,
      },
      table: {
        id: table.id,
        label: table.label,
        seats: table.seats,
      },
      outlet: {
        id: table.outlet.id,
        name: table.outlet.name,
      },
    };
  }

  // Create new session with a guest token
  const guestToken = generateSecureToken();
  const guestTokenHash = hashToken(guestToken);

  const newSession = await prisma.tableSession.create({
    data: {
      outlet_id: table.outlet_id,
      table_id: table.id,
      guest_token: guestTokenHash,
      status: 'open',
    },
    select: {
      id: true,
      outlet_id: true,
      table_id: true,
      status: true,
      opened_at: true,
    },
  });

  // Set guest cookie
  setGuestCookie(res, guestToken);

  return {
    session: {
      id: newSession.id,
      outlet_id: newSession.outlet_id,
      table_id: newSession.table_id,
      status: newSession.status,
      opened_at: newSession.opened_at,
    },
    table: {
      id: table.id,
      label: table.label,
      seats: table.seats,
    },
    outlet: {
      id: table.outlet.id,
      name: table.outlet.name,
    },
  };
}

/**
 * Gets the current session for the guest based on the guest token cookie.
 */
export async function getCurrentSession(req: Request): Promise<CurrentSessionResult> {
  const cookies = req.cookies as Record<string, string | undefined>;
  const guestToken = cookies[GUEST_COOKIE_NAME];

  if (!guestToken) {
    throw new AppError('NOT_FOUND', 'No active session', 404);
  }

  const guestTokenHash = hashToken(guestToken);

  interface SessionWithIncludes {
    id: string;
    outlet_id: string;
    table_id: string;
    status: string;
    opened_at: Date;
    table: { id: string; label: string; seats: number | null };
    outlet: {
      id: string;
      name: string;
      tax_percent: Prisma.Decimal;
      service_charge_percent: Prisma.Decimal;
    };
    orders: Array<{
      id: string;
      order_number: number;
      status: string;
      subtotal: Prisma.Decimal;
      tax_amount: Prisma.Decimal;
      discount_amount: Prisma.Decimal;
      total: Prisma.Decimal;
      created_at: Date;
      items: Array<{
        id: string;
        menu_item_id: string;
        item_name: string;
        quantity: number;
        unit_price: Prisma.Decimal;
        line_total: Prisma.Decimal;
        status: string;
      }>;
    }>;
  }

  const session = (await prisma.tableSession.findFirst({
    where: {
      guest_token: guestTokenHash,
      status: { not: 'closed' },
    },
    include: {
      table: {
        select: {
          id: true,
          label: true,
          seats: true,
        },
      },
      outlet: {
        select: {
          id: true,
          name: true,
          tax_percent: true,
          service_charge_percent: true,
        },
      },
      orders: {
        where: {
          status: { notIn: ['cancelled'] },
        },
        include: {
          items: {
            select: {
              id: true,
              menu_item_id: true,
              item_name: true,
              quantity: true,
              unit_price: true,
              line_total: true,
              status: true,
            },
          },
        },
        orderBy: { created_at: 'asc' },
      },
    },
  })) as SessionWithIncludes | null;

  if (!session) {
    throw new AppError('NOT_FOUND', 'No active session', 404);
  }

  return {
    session: {
      id: session.id,
      outlet_id: session.outlet_id,
      table_id: session.table_id,
      status: session.status,
      opened_at: session.opened_at,
    },
    table: {
      id: session.table.id,
      label: session.table.label,
      seats: session.table.seats,
    },
    outlet: {
      id: session.outlet.id,
      name: session.outlet.name,
      tax_percent: session.outlet.tax_percent.toString(),
      service_charge_percent: session.outlet.service_charge_percent.toString(),
    },
    orders: session.orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      subtotal: order.subtotal.toString(),
      tax_amount: order.tax_amount.toString(),
      discount_amount: order.discount_amount.toString(),
      total: order.total.toString(),
      created_at: order.created_at,
      items: order.items.map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id,
        name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price.toString(),
        total_price: item.line_total.toString(),
        status: item.status,
      })),
    })),
  };
}

export { clearGuestCookie };
