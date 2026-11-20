import { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getEffectiveMenuForOutlet } from '@/services/menu/menu.service';

export interface PublicOrderItemInput {
  menuItemId: string;
  quantity: number;
  options?: Array<{
    optionId: string;
    quantity: number;
  }>;
}

export interface PublicOrderInput {
  items: PublicOrderItemInput[];
  idempotencyKey: string;
  notes?: string;
}

export interface PublicOrderResult {
  order: {
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
  };
  session: {
    id: string;
    table_id: string;
    outlet_id: string;
  };
}

/**
 * Places a public order from a guest session.
 * Validates items against effective menu, calculates pricing server-side,
 * creates order with pending_confirmation status, and ensures idempotency.
 */
export async function placePublicOrder(
  req: Request,
  input: PublicOrderInput,
): Promise<PublicOrderResult> {
  // Get session from guest token cookie
  const cookies = (req as unknown as { cookies: Record<string, string | undefined> }).cookies;
  const guestToken = cookies['guest_token'];

  if (!guestToken) {
    throw new AppError('UNAUTHENTICATED', 'No active session', 401);
  }

  // Find session by guest token
  const { hashToken } = await import('@/utils/token');
  const guestTokenHash = hashToken(guestToken);

  const session = await prisma.tableSession.findFirst({
    where: {
      guest_token: guestTokenHash,
    },
    select: {
      id: true,
      outlet_id: true,
      table_id: true,
      status: true,
    },
  });

  if (!session) {
    throw new AppError('UNAUTHENTICATED', 'Invalid or expired session', 401);
  }

  if (session.status !== 'open') {
    throw new AppError('VALIDATION_ERROR', 'Session is not open for orders', 400);
  }

  // Check idempotency key
  if (input.idempotencyKey) {
    const existingOrder = await prisma.order.findFirst({
      where: {
        idempotency_key: input.idempotencyKey,
        outlet_id: session.outlet_id,
      },
      select: { id: true },
    });

    if (existingOrder) {
      throw new AppError('CONFLICT', 'Order with this idempotency key already exists', 409);
    }
  }

  // Get effective menu for outlet to validate items and get prices
  const effectiveMenu = await getEffectiveMenuForOutlet(session.outlet_id);

  // Build a map of available menu items for quick lookup
  const itemMap = new Map<
    string,
    {
      item: {
        id: string;
        name: string;
        base_price: string;
        override_price: string | null;
        is_available: boolean;
      };
      categoryName: string;
    }
  >();

  for (const category of effectiveMenu.categories) {
    for (const item of category.items) {
      itemMap.set(item.id, { item, categoryName: category.name });
    }
  }

  // Validate items and calculate prices
  const orderItems: Array<{
    menu_item_id: string;
    outlet_id: string;
    item_name: string;
    quantity: number;
    unit_price: Prisma.Decimal;
    line_total: Prisma.Decimal;
    status: 'placed';
    options: Prisma.InputJsonValue;
  }> = [];

  let subtotal = new Prisma.Decimal(0);

  for (const inputItem of input.items) {
    const found = itemMap.get(inputItem.menuItemId);

    if (!found) {
      // Check if item exists in database but is inactive
      const dbItem = await prisma.menuItem.findUnique({
        where: { id: inputItem.menuItemId },
        select: { id: true, name: true, is_active: true },
      });

      if (!dbItem) {
        throw new AppError('NOT_FOUND', `Menu item ${inputItem.menuItemId} not found`, 404);
      }

      if (!dbItem.is_active) {
        throw new AppError('VALIDATION_ERROR', `Menu item ${dbItem.name} is not available`, 400);
      }

      // Item exists and is active but not in effective menu (e.g., outlet override unavailable)
      throw new AppError(
        'VALIDATION_ERROR',
        `Menu item ${dbItem.name} is not available at this outlet`,
        400,
      );
    }

    if (!found.item.is_available) {
      throw new AppError('VALIDATION_ERROR', `Menu item ${found.item.name} is not available`, 400);
    }

    if (inputItem.quantity <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Quantity must be positive', 400);
    }

    // Use override price if available, otherwise base price
    const price = found.item.override_price
      ? new Prisma.Decimal(found.item.override_price)
      : new Prisma.Decimal(found.item.base_price);
    const lineTotal = price.mul(inputItem.quantity);

    orderItems.push({
      menu_item_id: inputItem.menuItemId,
      outlet_id: session.outlet_id,
      item_name: found.item.name,
      quantity: inputItem.quantity,
      unit_price: price,
      line_total: lineTotal,
      status: 'placed',
      options: inputItem.options ?? [],
    });

    subtotal = subtotal.add(lineTotal);
  }

  if (orderItems.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Order must have at least one item', 400);
  }

  // Calculate tax and total
  const outlet = await prisma.outlet.findUniqueOrThrow({
    where: { id: session.outlet_id },
    select: { tax_percent: true, service_charge_percent: true },
  });

  const taxPercent = new Prisma.Decimal(outlet.tax_percent);
  const serviceChargePercent = new Prisma.Decimal(outlet.service_charge_percent);

  const taxAmount = subtotal.mul(taxPercent).div(100);
  const serviceChargeAmount = subtotal.mul(serviceChargePercent).div(100);
  const total = subtotal.add(taxAmount).add(serviceChargeAmount);

  // Get next order number for this outlet and business date
  const businessDate = new Date();
  businessDate.setHours(0, 0, 0, 0);

  const lastOrder = await prisma.order.findFirst({
    where: {
      outlet_id: session.outlet_id,
      business_date: businessDate,
    },
    orderBy: { order_number: 'desc' },
    select: { order_number: true },
  });

  const orderNumber = (lastOrder?.order_number ?? 0) + 1;

  // Create order with items in a transaction (increase timeout to 15 seconds)
  const order = await prisma.$transaction(
    async (tx) => {
      // Update table status to occupied first
      await tx.diningTable.update({
        where: { id: session.table_id },
        data: { status: 'occupied' },
      });

      const createdOrder = await tx.order.create({
        data: {
          outlet_id: session.outlet_id,
          order_number: orderNumber,
          order_type: 'dine_in',
          status: 'pending_confirmation',
          session_id: session.id,
          table_id: session.table_id,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: new Prisma.Decimal(0),
          total,
          idempotency_key: input.idempotencyKey,
          notes: input.notes ?? null,
          business_date: businessDate,
          items: {
            create: orderItems.map((item) => ({
              menuItem: { connect: { id: item.menu_item_id } },
              outlet: { connect: { id: item.outlet_id } },
              item_name: item.item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
              status: item.status,
              options: item.options,
            })),
          },
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
              options: true,
            },
          },
        },
      });

      return createdOrder;
    },
    { timeout: 15000 }, // 15 second timeout
  );

  const formatPrice = (value: Prisma.Decimal): string => value.toFixed(2);

  return {
    order: {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      subtotal: formatPrice(order.subtotal),
      tax_amount: formatPrice(order.tax_amount),
      discount_amount: formatPrice(order.discount_amount),
      total: formatPrice(order.total),
      created_at: order.created_at,
      items: order.items.map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id,
        name: item.item_name,
        quantity: item.quantity,
        unit_price: formatPrice(item.unit_price),
        total_price: formatPrice(item.line_total),
        status: item.status,
        options: item.options ?? [],
      })),
    },
    session: {
      id: session.id,
      table_id: session.table_id,
      outlet_id: session.outlet_id,
    },
  };
}

/**
 * Gets order details for a guest (own session only).
 */
export async function getPublicOrder(req: Request, orderId: string) {
  const cookies = (req as unknown as { cookies: Record<string, string | undefined> }).cookies;
  const guestToken = cookies['guest_token'];

  if (!guestToken) {
    throw new AppError('UNAUTHENTICATED', 'No active session', 401);
  }

  const { hashToken } = await import('@/utils/token');
  const guestTokenHash = hashToken(guestToken);

  const session = await prisma.tableSession.findFirst({
    where: {
      guest_token: guestTokenHash,
      status: { not: 'closed' },
    },
    select: { id: true },
  });

  if (!session) {
    throw new AppError('NOT_FOUND', 'No active session', 404);
  }

  interface OrderWithItems {
    id: string;
    order_number: number;
    status: string;
    subtotal: Prisma.Decimal;
    tax_amount: Prisma.Decimal;
    discount_amount: Prisma.Decimal;
    total: Prisma.Decimal;
    created_at: Date;
    confirmed_at: Date | null;
    items: Array<{
      id: string;
      menu_item_id: string;
      item_name: string;
      quantity: number;
      unit_price: Prisma.Decimal;
      line_total: Prisma.Decimal;
      status: string;
      options: Prisma.InputJsonValue;
    }>;
  }

  const order = (await prisma.order.findFirst({
    where: {
      id: orderId,
      session_id: session.id,
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
          options: true,
        },
      },
    },
  })) as OrderWithItems | null;

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  const formatPrice = (value: Prisma.Decimal): string => value.toFixed(2);

  return {
    order: {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      subtotal: formatPrice(order.subtotal),
      tax_amount: formatPrice(order.tax_amount),
      discount_amount: formatPrice(order.discount_amount),
      total: formatPrice(order.total),
      created_at: order.created_at,
      confirmed_at: order.confirmed_at,
      items: order.items.map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id,
        name: item.item_name,
        quantity: item.quantity,
        unit_price: formatPrice(item.unit_price),
        total_price: formatPrice(item.line_total),
        status: item.status,
        options: item.options ?? [],
      })),
    },
  };
}
