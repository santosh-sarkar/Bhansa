import type { Prisma } from '@prisma/client';
import { getIO } from '@/lib/socket';
import { emitToOutletManagers } from '@/lib/socket';
import { updateAutoUnavailableForIngredient } from '@/services/inventory/auto-unavailable.service';

type TransactionClient = Prisma.TransactionClient;

export interface StockDeductionResult {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  quantity_deducted: number;
  balance_after: number;
  movement_id: string;
}

/**
 * Deducts stock for an order based on recipes.
 * Uses row-level locks (SELECT FOR UPDATE) to prevent race conditions.
 * Creates stock movement records with type 'order_deduction'.
 */
export async function deductStockForOrder(
  tx: TransactionClient,
  orderId: string,
  outletId: string,
  items: Array<{
    id: string;
    menu_item_id: string;
    quantity: number;
    item_name: string;
  }>,
  actorId: string,
): Promise<StockDeductionResult[]> {
  const results: StockDeductionResult[] = [];

  for (const item of items) {
    // Get recipe for this menu item
    const recipe = await tx.recipeItem.findMany({
      where: { menu_item_id: item.menu_item_id },
      select: {
        ingredient_id: true,
        quantity: true,
        ingredient: { select: { name: true, unit: true } },
      },
    });

    if (recipe.length === 0) {
      // No recipe defined, skip deduction
      continue;
    }

    for (const r of recipe) {
      const totalQty = Number(r.quantity) * item.quantity;

      // Use SELECT FOR UPDATE to lock the stock row
      // This prevents race conditions when multiple orders are confirmed simultaneously
      const stock = await tx.$queryRaw<
        Array<{
          outlet_id: string;
          ingredient_id: string;
          quantity: Prisma.Decimal;
          low_threshold: Prisma.Decimal | null;
        }>
      >`
        SELECT outlet_id, ingredient_id, quantity, low_threshold
        FROM "outlet_stock"
        WHERE outlet_id = ${outletId} AND ingredient_id = ${r.ingredient_id}
        FOR UPDATE
      `;

      if (stock.length === 0 || stock[0] === undefined) {
        // No stock record exists - this means ingredient is not stocked at this outlet
        // We'll create a stock record with negative quantity to track the deficit
        const newQuantity = -totalQty;

        await tx.outletStock.create({
          data: {
            outlet_id: outletId,
            ingredient_id: r.ingredient_id,
            quantity: newQuantity,
            low_threshold: 0,
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            outlet_id: outletId,
            ingredient_id: r.ingredient_id,
            type: 'order_deduction',
            quantity_delta: -totalQty,
            balance_after: newQuantity,
            order_id: orderId,
            performed_by: actorId,
            reason: `Order deduction for ${item.item_name} (${item.quantity}x)`,
          },
        });

        results.push({
          ingredient_id: r.ingredient_id,
          ingredient_name: r.ingredient.name,
          ingredient_unit: r.ingredient.unit,
          quantity_deducted: totalQty,
          balance_after: newQuantity,
          movement_id: movement.id,
        });

        // Check for low stock (negative stock is definitely low)
        await checkAndEmitLowStock(tx, outletId, r.ingredient_id, newQuantity);

        // Update auto_unavailable for menu items using this ingredient
        await updateAutoUnavailableForIngredient(tx, outletId, r.ingredient_id, newQuantity);

        continue;
      }

      const currentQuantity = Number(stock[0].quantity);
      const newQuantity = currentQuantity - totalQty;

      if (newQuantity < 0) {
        // Stock would go negative - check if this should be allowed
        // For now, allow it but track as negative (can be configured later)
      }

      // Update stock with decrement
      await tx.outletStock.update({
        where: {
          outlet_id_ingredient_id: {
            outlet_id: outletId,
            ingredient_id: r.ingredient_id,
          },
        },
        data: { quantity: { decrement: totalQty } },
      });

      // Record stock movement
      const movement = await tx.stockMovement.create({
        data: {
          outlet_id: outletId,
          ingredient_id: r.ingredient_id,
          type: 'order_deduction',
          quantity_delta: -totalQty,
          balance_after: newQuantity,
          order_id: orderId,
          performed_by: actorId,
          reason: `Order deduction for ${item.item_name} (${item.quantity}x)`,
        },
      });

      results.push({
        ingredient_id: r.ingredient_id,
        ingredient_name: r.ingredient.name,
        ingredient_unit: r.ingredient.unit,
        quantity_deducted: totalQty,
        balance_after: newQuantity,
        movement_id: movement.id,
      });

      // Check and emit low stock event if below threshold
      await checkAndEmitLowStock(tx, outletId, r.ingredient_id, newQuantity);

      // Update auto_unavailable for menu items using this ingredient
      await updateAutoUnavailableForIngredient(tx, outletId, r.ingredient_id, newQuantity);
    }
  }

  return results;
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
