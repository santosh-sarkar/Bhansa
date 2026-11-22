import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getIO } from '@/lib/socket';
import {
  emitToOutletWaiters,
  emitToOutletKitchen,
  emitToOutletManagers,
  emitToSession,
} from '@/lib/socket';
import type { TableStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

export type OrderStatus =
  'pending_confirmation' | 'placed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';

export type OrderItemStatus = 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled';

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
 * Derives order status from item statuses (PD-009).
 * If all items are cancelled -> cancelled
 * If all items are served -> served
 * If all items are ready -> ready
 * If all items are preparing -> preparing
 * If any item is placed -> placed
 * Default -> placed
 */
export function deriveOrderStatus(itemStatuses: OrderItemStatus[]): OrderStatus {
  if (itemStatuses.length === 0) return 'placed';

  const uniqueStatuses = [...new Set(itemStatuses)];

  if (uniqueStatuses.length === 1) {
    const single = uniqueStatuses[0];
    if (single === 'cancelled') return 'cancelled';
    if (single === 'served') return 'served';
    if (single === 'ready') return 'ready';
    if (single === 'preparing') return 'preparing';
    if (single === 'placed') return 'placed';
  }

  // Mixed statuses - order follows the "furthest behind" item
  if (uniqueStatuses.includes('placed')) return 'placed';
  if (uniqueStatuses.includes('preparing')) return 'preparing';
  if (uniqueStatuses.includes('ready')) return 'ready';
  if (uniqueStatuses.includes('served')) return 'served';
  if (uniqueStatuses.includes('cancelled')) return 'cancelled';

  return 'placed';
}

/**
 * Transitions an order to a new status.
 * Validates the transition is allowed, updates the order, and emits Socket.IO events.
 */
export async function transitionOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  actor: { userId: string; outletId: string | null; role: string; organizationId: string },
  reason?: string,
  currentStatus?: OrderStatus,
): Promise<{
  order: {
    id: string;
    outlet_id: string;
    status: OrderStatus;
    confirmed_at: Date | null;
    cancel_reason: string | null;
    session_id: string | null;
    table_id: string | null;
    items: Array<{
      id: string;
      menu_item_id: string;
      item_name: string;
      quantity: number;
      status: OrderItemStatus;
    }>;
  };
  previousStatus: OrderStatus;
}> {
  // Fetch current order if currentStatus not provided
  if (!currentStatus) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) {
      throw new AppError('NOT_FOUND', 'Order not found', 404);
    }
    currentStatus = order.status;
  }

  // Validate transition
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
  const txResult = await prisma.$transaction(
    async (tx) => {
      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...(newStatus === 'placed'
            ? { confirmed_at: new Date(), confirmed_by: actor.userId }
            : {}),
          ...(newStatus === 'cancelled'
            ? {
                cancelled_at: new Date(),
                cancel_reason: reason ?? null,
                cancelled_by: actor.userId,
              }
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
                const newQuantity = Number(stock.quantity) + totalQty;

                await tx.outletStock.update({
                  where: {
                    outlet_id_ingredient_id: {
                      outlet_id: stock.outlet_id,
                      ingredient_id: stock.ingredient_id,
                    },
                  },
                  data: { quantity: { increment: totalQty } },
                });

                // Record stock movement
                await tx.stockMovement.create({
                  data: {
                    outlet_id: updatedOrder.outlet_id,
                    ingredient_id: r.ingredient_id,
                    type: 'order_restore',
                    quantity_delta: totalQty,
                    balance_after: newQuantity,
                    order_id: updatedOrder.id,
                    reason: `Stock restored from cancelled order ${updatedOrder.id}`,
                  },
                });

                // Check and emit low stock event if below threshold
                await checkAndEmitLowStock(
                  tx,
                  updatedOrder.outlet_id,
                  r.ingredient_id,
                  newQuantity,
                );
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
          where: { order_id: orderId, status: 'preparing' },
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
        let newTableStatus: TableStatus | null = null;
        if (newStatus === 'placed' || newStatus === 'preparing' || newStatus === 'ready') {
          newTableStatus = 'occupied';
        } else if (
          newStatus === 'served' ||
          newStatus === 'completed' ||
          newStatus === 'cancelled'
        ) {
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
            data: { status: newTableStatus },
          });
        }
      }

      // Return the data needed for event emission
      return {
        order: {
          id: updatedOrder.id,
          outlet_id: updatedOrder.outlet_id,
          status: updatedOrder.status,
          confirmed_at: updatedOrder.confirmed_at,
          cancel_reason: updatedOrder.cancel_reason,
          session_id: updatedOrder.session_id,
          table_id: updatedOrder.table_id,
          items: updatedOrder.items.map((item) => ({
            id: item.id,
            menu_item_id: item.menu_item_id,
            item_name: item.item_name,
            quantity: item.quantity,
            status: item.status,
          })),
        },
        previousStatus: currentStatus,
      };
    },
    { timeout: 15000 },
  );
  // Emit Socket.IO events after transaction commits
  const io = getIO();
  if (io) {
    const outletId = txResult.order.outlet_id;

    switch (newStatus) {
      case 'placed': {
        // order:confirmed - notify kitchen
        const confirmedEvent = {
          orderId: txResult.order.id,
          items: txResult.order.items
            .filter((i) => i.status !== 'cancelled')
            .map((item) => ({
              menuItemId: item.menu_item_id,
              name: item.item_name,
              quantity: item.quantity,
            })),
          createdAt: txResult.order.confirmed_at?.toISOString() ?? new Date().toISOString(),
        };
        emitToOutletKitchen(io, outletId, 'order:confirmed', confirmedEvent);
        break;
      }
      case 'cancelled': {
        // order:rejected - notify session (guest) if rejected
        if (currentStatus === 'pending_confirmation') {
          const rejectedEvent = {
            orderId: txResult.order.id,
            reason: txResult.order.cancel_reason ?? 'Rejected by staff',
          };
          if (txResult.order.session_id) {
            emitToSession(io, txResult.order.session_id, 'order:rejected', rejectedEvent);
          }
        }
        // order:status_changed - notify all
        const statusChangedEvent = {
          orderId: txResult.order.id,
          status: newStatus,
          previousStatus: currentStatus,
        };
        emitToOutletWaiters(io, outletId, 'order:status_changed', statusChangedEvent);
        emitToOutletKitchen(io, outletId, 'order:status_changed', statusChangedEvent);
        emitToOutletManagers(io, outletId, 'order:status_changed', statusChangedEvent);
        if (txResult.order.session_id) {
          emitToSession(io, txResult.order.session_id, 'order:status_changed', statusChangedEvent);
        }
        break;
      }
      case 'preparing':
      case 'ready':
      case 'served':
      case 'completed': {
        const statusChangedEvent = {
          orderId: txResult.order.id,
          status: newStatus,
          previousStatus: currentStatus,
        };
        emitToOutletWaiters(io, outletId, 'order:status_changed', statusChangedEvent);
        emitToOutletKitchen(io, outletId, 'order:status_changed', statusChangedEvent);
        emitToOutletManagers(io, outletId, 'order:status_changed', statusChangedEvent);
        if (txResult.order.session_id) {
          emitToSession(io, txResult.order.session_id, 'order:status_changed', statusChangedEvent);
        }
        break;
      }
    }
  }
  return { order: txResult.order, previousStatus: txResult.previousStatus };
}

/**
 * Transitions an order item status.
 */
export async function transitionOrderItemStatus(
  itemId: string,
  newStatus: OrderItemStatus,
  actor: { userId: string; outletId: string | null; role: string },
): Promise<{
  item: {
    id: string;
    menu_item_id: string;
    item_name: string;
    quantity: number;
    status: OrderItemStatus;
    order_id: string;
  };
  previousStatus: OrderItemStatus;
}> {
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

  const currentStatus = item.status;

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
          select: { ingredient_id: true, quantity: true, ingredient: { select: { unit: true } } },
        });

        for (const r of recipe) {
          const totalQty = Number(r.quantity) * updated.quantity;
          const stock = await tx.outletStock.findFirst({
            where: { outlet_id: item.order.outlet_id, ingredient_id: r.ingredient_id },
            select: { outlet_id: true, ingredient_id: true, quantity: true },
          });
          if (stock) {
            const newQuantity = Number(stock.quantity) + totalQty;
            await tx.outletStock.update({
              where: {
                outlet_id_ingredient_id: {
                  outlet_id: stock.outlet_id,
                  ingredient_id: stock.ingredient_id,
                },
              },
              data: { quantity: { increment: totalQty } },
            });
            await tx.stockMovement.create({
              data: {
                outlet_id: item.order.outlet_id,
                ingredient_id: r.ingredient_id,
                type: 'order_restore',
                quantity_delta: totalQty,
                balance_after: newQuantity,
                reason: `Stock restored from cancelled item ${item.id}`,
              },
            });

            // Check and emit low stock event if below threshold
            await checkAndEmitLowStock(tx, item.order.outlet_id, r.ingredient_id, newQuantity);
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

  // Emit socket events after transaction commits for item cancellation
  if (newStatus === 'cancelled') {
    const io = getIO();
    if (io) {
      const outletId = item.order.outlet_id;
      const sessionId = item.order.session_id;

      // item:cancelled - notify kitchen and waiters
      const cancelledEvent = {
        orderId: item.order_id,
        itemId: updatedItem.id,
        itemName: updatedItem.item_name,
        quantity: updatedItem.quantity,
        reason: 'Item unavailable',
      };
      emitToOutletKitchen(io, outletId, 'item:cancelled', cancelledEvent);
      emitToOutletWaiters(io, outletId, 'item:cancelled', cancelledEvent);

      // Notify guest session if exists
      if (sessionId) {
        emitToSession(io, sessionId, 'item:cancelled', cancelledEvent);
      }
    }
  }

  return { item: updatedItem, previousStatus: currentStatus };
}

/**
 * Checks if stock is below low threshold and emits a socket event if so.
 * This is called after stock quantity changes (increment or decrement).
 */
async function checkAndEmitLowStock(
  tx: TransactionClient,
  outletId: string,
  ingredientId: string,
  newQuantity: number,
): Promise<void> {
  // Get the stock record with low_threshold
  const stock = await tx.outletStock.findUnique({
    where: {
      outlet_id_ingredient_id: {
        outlet_id: outletId,
        ingredient_id: ingredientId,
      },
    },
    select: {
      low_threshold: true,
      ingredient: { select: { id: true, name: true } },
    },
  });

  if (!stock || stock.low_threshold === null || Number(stock.low_threshold) === 0) {
    return; // No threshold set or zero threshold
  }

  const threshold = Number(stock.low_threshold);
  if (newQuantity <= threshold) {
    const io = getIO();
    if (io) {
      emitToOutletManagers(io, outletId, 'stock:low', {
        ingredientId: stock.ingredient.id,
        name: stock.ingredient.name,
        currentStock: newQuantity,
        threshold,
        outletId,
      });
    }
  }
}
