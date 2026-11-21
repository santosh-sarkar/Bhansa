import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';

export type OrderStatus =
  | 'pending_confirmation'
  | 'placed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export type OrderItemStatus =
  | 'placed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

// Allowed transitions for orders (from -> [to])
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ['placed', 'cancelled'],
  placed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Allowed transitions for order items (from -> [to])
const ORDER_ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  placed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: ['cancelled'],
  cancelled: [],
};

/**
 * Checks if a transition is allowed for an order.
 */
export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ORDER_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Checks if a transition is allowed for an order item.
 */
export function isValidOrderItemTransition(from: OrderItemStatus, to: OrderItemStatus): boolean {
  const allowed = ORDER_ITEM_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Gets the next statuses that can be transitioned to from the current status.
 */
export function getAllowedOrderTransitions(status: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[status] ?? [];
}

/**
 * Gets the next statuses that can be transitioned to from the current item status.
 */
export function getAllowedOrderItemTransitions(status: OrderItemStatus): OrderItemStatus[] {
  return ORDER_ITEM_TRANSITIONS[status] ?? [];
}

/**
 * Validates and performs an order status transition.
 * Enforces PD-008: cancellation rules.
 */
export async function transitionOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  actor: {
    userId: string;
    role: string;
    outletId: string | null;
    organizationId: string;
  },
  reason?: string,
): Promise<{ order: any; previousStatus: OrderStatus }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      outlet_id: true,
      session_id: true,
      table_id: true,
    },
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  // Check outlet access
  if (actor.role !== 'owner' && order.outlet_id !== actor.outletId) {
    throw new AppError('FORBIDDEN', 'Not authorized for this outlet', 403);
  }

  const currentStatus = order.status as OrderStatus;

  if (!isValidOrderTransition(currentStatus, newStatus)) {
    throw new AppError(
      'INVALID_STATE_TRANSITION',
      `Cannot transition from ${currentStatus} to ${newStatus}`,
      400,
    );
  }

  // PD-008: Cancellation rules
  if (newStatus === 'cancelled') {
    // Staff (waiter/manager) can cancel before 'served'
    // Owner can cancel anytime
    const isStaff = ['waiter', 'manager', 'owner'].includes(actor.role);
    const isOwner = actor.role === 'owner';

    // Before 'preparing': anyone with order.cancel can cancel
    if (['pending_confirmation', 'placed'].includes(currentStatus)) {
      // OK - stock will be restored
    }
    // At 'preparing': only manager/owner can cancel, stock NOT restored
    else if (currentStatus === 'preparing') {
      if (!isOwner && actor.role !== 'manager') {
        throw new AppError('FORBIDDEN', 'Only manager or owner can cancel during preparing', 403);
      }
      // Stock NOT restored for preparing
    }
    // After 'preparing': only owner can cancel, stock NOT restored
    else if (['ready', 'served'].includes(currentStatus)) {
      if (!isOwner) {
        throw new AppError('FORBIDDEN', 'Only owner can cancel after preparing', 403);
      }
      // Stock NOT restored
    }
    // Completed cannot be cancelled
    else if (currentStatus === 'completed') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Cannot cancel completed order', 400);
    }
  }

  // Use transaction for consistency
  const result = await prisma.$transaction(async (tx) => {
    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        ...(newStatus === 'placed'
          ? { confirmed_at: new Date(), confirmed_by: actor.userId }
          : {}),
        ...(newStatus === 'cancelled'
          ? { cancelled_at: new Date(), cancel_reason: reason ?? null, cancelled_by: actor.userId }
          : {}),
      },
      include: {
        items: true,
        session: true,
      },
    });

    // If cancelling before preparing, restore stock
    if (newStatus === 'cancelled' && ['pending_confirmation', 'placed'].includes(currentStatus)) {
      for (const item of updatedOrder.items) {
        if (item.status !== 'cancelled') {
          // Get recipe for this menu item
          const recipe = await tx.recipeItem.findMany({
            where: { menu_item_id: item.menu_item_id },
            select: {
              ingredient_id: true,
              quantity: true,
              ingredient: { select: { unit: true } },
            },
          });

          for (const r of recipe) {
            const totalQty = Number(r.quantity) * item.quantity;

            // Find stock record for this outlet and ingredient
            const stock = await tx.outletStock.findFirst({
              where: {
                outlet_id: updatedOrder.outlet_id,
                ingredient_id: r.ingredient_id,
              },
              select: { outlet_id: true, ingredient_id: true, quantity: true },
            });

            if (stock) {
              await tx.outletStock.update({
                where: { outlet_id_ingredient_id: { outlet_id: stock.outlet_id, ingredient_id: stock.ingredient_id } },
                data: { quantity: { increment: totalQty } },
              });

              // Record stock movement
              await tx.stockMovement.create({
                data: {
                  outlet_id: updatedOrder.outlet_id,
                  ingredient_id: r.ingredient_id,
                  type: 'order_restore',
                  quantity_delta: totalQty,
                  balance_after: Number(stock.quantity) + totalQty,
                  order_id: updatedOrder.id,
                  reason: `Stock restored from cancelled order ${updatedOrder.id}`,
                },
              });
            }
          }
        }
      }
    }

    // If moving to preparing, update item statuses
    if (newStatus === 'preparing') {
      await tx.orderItem.updateMany({
        where: { order_id: orderId, status: 'placed' },
        data: { status: 'preparing' },
      });
    }

    // If moving to ready, update item statuses
    if (newStatus === 'ready') {
      await tx.orderItem.updateMany({
        where: { order_id: orderId, status: 'preparing' },
        data: { status: 'ready' },
      });
    }

    // If moving to served, update item statuses
    if (newStatus === 'served') {
      await tx.orderItem.updateMany({
        where: { order_id: orderId, status: 'ready' },
        data: { status: 'served' },
      });
    }

    // If moving to completed, update item statuses
    if (newStatus === 'completed') {
      await tx.orderItem.updateMany({
        where: { order_id: orderId, status: 'served' },
        data: { status: 'served' }, // Already served, just marking order complete
      });
    }

    // If cancelling, update item statuses to cancelled
    if (newStatus === 'cancelled') {
      await tx.orderItem.updateMany({
        where: { order_id: orderId, status: { not: 'cancelled' } },
        data: { status: 'cancelled' },
      });
    }

    // Update table status based on order status
    if (updatedOrder.table_id) {
      let newTableStatus: string | null = null;
      if (newStatus === 'placed' || newStatus === 'preparing' || newStatus === 'ready') {
        newTableStatus = 'occupied';
      } else if (newStatus === 'served' || newStatus === 'completed' || newStatus === 'cancelled') {
        // Check if there are other active orders for this table
        const otherActiveOrders = await tx.order.count({
          where: {
            table_id: updatedOrder.table_id,
            status: { in: ['placed', 'preparing', 'ready'] },
            id: { not: orderId },
          },
        });
        if (otherActiveOrders === 0) {
          newTableStatus = 'needs_bill';
        }
      }
      if (newTableStatus) {
        await tx.diningTable.update({
          where: { id: updatedOrder.table_id },
          data: { status: newTableStatus as any },
        });
      }
    }

    return { order: updatedOrder, previousStatus: currentStatus };
  });

  return result;
}

/**
 * Transitions an order item status.
 */
export async function transitionOrderItemStatus(
  itemId: string,
  newStatus: OrderItemStatus,
  actor: { userId: string; outletId: string | null; role: string },
): Promise<{ item: any; previousStatus: OrderItemStatus }> {
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: true },
  });

  if (!item) {
    throw new AppError('NOT_FOUND', 'Order item not found', 404);
  }

  // Check outlet access
  if (actor.role !== 'owner' && item.order.outlet_id !== actor.outletId) {
    throw new AppError('FORBIDDEN', 'Not authorized for this outlet', 403);
  }

  const currentStatus = item.status as OrderItemStatus;

  if (!isValidOrderItemTransition(currentStatus, newStatus)) {
    throw new AppError(
      'INVALID_STATE_TRANSITION',
      `Cannot transition item from ${currentStatus} to ${newStatus}`,
      400,
    );
  }

  // If cancelling item, check if we can restore stock
  if (newStatus === 'cancelled' && ['placed', 'preparing'].includes(currentStatus)) {
    // Only allow if order is in a state where stock can be restored
    if (['pending_confirmation', 'placed'].includes(item.order.status)) {
      // Stock restoration will happen in the transaction
    } else if (item.order.status === 'preparing') {
      // Kitchen cancelling item during preparing - notify but don't restore stock
    } else {
      throw new AppError('FORBIDDEN', 'Cannot cancel item at this stage', 403);
    }
  }

  // PD-010: If kitchen marks item as cancelled (out of stock), notify waiter/guest
  // This is handled by the event emission after transition

  const updatedItem = await prisma.$transaction(async (tx) => {
    const updated = await tx.orderItem.update({
      where: { id: itemId },
      data: { status: newStatus },
    });

    // If item cancelled during placed/preparing, restore stock
    if (newStatus === 'cancelled' && ['placed', 'preparing'].includes(currentStatus)) {
      if (['pending_confirmation', 'placed'].includes(item.order.status)) {
        // Restore stock
        const recipe = await tx.recipeItem.findMany({
          where: { menu_item_id: item.menu_item_id },
          select: {
            ingredient_id: true,
            quantity: true,
            ingredient: { select: { unit: true } },
          },
        });

        for (const r of recipe) {
          const totalQty = Number(r.quantity) * updated.quantity;
          const stock = await tx.outletStock.findFirst({
            where: { outlet_id: item.order.outlet_id, ingredient_id: r.ingredient_id },
            select: { outlet_id: true, ingredient_id: true, quantity: true },
          });
          if (stock) {
            await tx.outletStock.update({
              where: { outlet_id_ingredient_id: { outlet_id: stock.outlet_id, ingredient_id: stock.ingredient_id } },
              data: { quantity: { increment: totalQty } },
            });
            await tx.stockMovement.create({
              data: {
                outlet_id: item.order.outlet_id,
                ingredient_id: r.ingredient_id,
                type: 'order_restore',
                quantity_delta: totalQty,
                balance_after: Number(stock.quantity) + totalQty,
                order_id: item.order.id,
                reason: `Stock restored from cancelled item ${item.id}`,
              },
            });
          }
        }
      }
    }

    // Check if all items in order have same status, update order status accordingly
    const orderItems = await tx.orderItem.findMany({
      where: { order_id: item.order_id },
      select: { status: true },
    });

    // Derive order status from item statuses (PD-009)
    const derivedStatus = deriveOrderStatus(orderItems.map((i) => i.status));
    if (derivedStatus !== item.order.status) {
      await tx.order.update({
        where: { id: item.order_id },
        data: { status: derivedStatus },
      });
    }

    return updated;
  });

  return { item: updatedItem, previousStatus: currentStatus };
}

/**
 * Derives order status from item statuses (PD-009).
 */
export function deriveOrderStatus(itemStatuses: OrderItemStatus[]): OrderStatus {
  if (itemStatuses.length === 0) return 'pending_confirmation';

  // If any item is pending_confirmation, order is pending_confirmation
  if (itemStatuses.some((s) => s === 'placed' && false)) {
    // Not applicable since placed items mean order is at least placed
  }

  // If all items cancelled, order is cancelled
  if (itemStatuses.every((s) => s === 'cancelled')) return 'cancelled';

  // If all items served, order is served
  if (itemStatuses.every((s) => s === 'served')) return 'served';

  // If all items ready or served, order is ready
  if (itemStatuses.every((s) => ['ready', 'served'].includes(s))) return 'ready';

  // If any item preparing, order is preparing
  if (itemStatuses.some((s) => s === 'preparing')) return 'preparing';

  // If any item placed, order is placed
  if (itemStatuses.some((s) => s === 'placed')) return 'placed';

  return 'pending_confirmation';
}