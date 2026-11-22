import type { Prisma } from '@prisma/client';
import { getIO } from '@/lib/socket';
import { emitToOutletManagers } from '@/lib/socket';

type TransactionClient = Prisma.TransactionClient;

/**
 * Checks if a menu item can be made at an outlet based on stock levels.
 * Returns true if all required ingredients have stock > 0.
 */
export async function canMakeMenuItem(
  tx: TransactionClient,
  outletId: string,
  menuItemId: string,
): Promise<boolean> {
  const recipe = await tx.recipeItem.findMany({
    where: { menu_item_id: menuItemId },
    select: { ingredient_id: true, quantity: true },
  });

  if (recipe.length === 0) {
    // No recipe defined, assume can make
    return true;
  }

  for (const r of recipe) {
    const stock = await tx.outletStock.findUnique({
      where: {
        outlet_id_ingredient_id: {
          outlet_id: outletId,
          ingredient_id: r.ingredient_id,
        },
      },
      select: { quantity: true },
    });

    if (!stock || Number(stock.quantity) <= 0) {
      return false;
    }
  }

  return true;
}

/**
 * Gets all menu items that use a specific ingredient at an outlet.
 */
export async function getMenuItemsUsingIngredient(
  tx: TransactionClient,
  outletId: string,
  ingredientId: string,
): Promise<Array<{ menu_item_id: string; outlet_id: string }>> {
  // Find all recipe items using this ingredient
  const recipes = await tx.recipeItem.findMany({
    where: { ingredient_id: ingredientId },
    select: { menu_item_id: true },
  });

  if (recipes.length === 0) return [];

  const menuItemIds = recipes.map((r) => r.menu_item_id);

  // Check which of these menu items are active and have overrides for this outlet
  const items = await tx.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      is_active: true,
      deleted_at: null,
    },
    select: { id: true },
  });

  return items.map((item) => ({
    menu_item_id: item.id,
    outlet_id: outletId,
  }));
}

/**
 * Updates auto_unavailable flag for menu items at an outlet when stock changes.
 * Called after stock deduction or restock.
 */
export async function updateAutoUnavailableForIngredient(
  tx: TransactionClient,
  outletId: string,
  ingredientId: string,
  newStockQuantity: number,
): Promise<void> {
  const menuItems = await getMenuItemsUsingIngredient(tx, outletId, ingredientId);

  if (menuItems.length === 0) return;

  // Check if stock is at or below 0 (out of stock)
  const isOutOfStock = newStockQuantity <= 0;

  for (const item of menuItems) {
    // Check if this menu item can be made (all ingredients in stock)
    const canMake = await canMakeMenuItem(tx, outletId, item.menu_item_id);

    // If out of stock for this ingredient OR cannot make due to other ingredients
    const shouldBeUnavailable = isOutOfStock || !canMake;

    // Get current override
    const override = await tx.menuItemOutletOverride.findUnique({
      where: {
        menu_item_id_outlet_id: {
          menu_item_id: item.menu_item_id,
          outlet_id: item.outlet_id,
        },
      },
      select: { auto_unavailable: true },
    });

    const currentAutoUnavailable = override?.auto_unavailable ?? false;

    if (shouldBeUnavailable !== currentAutoUnavailable) {
      // Update or create override
      await tx.menuItemOutletOverride.upsert({
        where: {
          menu_item_id_outlet_id: {
            menu_item_id: item.menu_item_id,
            outlet_id: item.outlet_id,
          },
        },
        update: {
          auto_unavailable: shouldBeUnavailable,
        },
        create: {
          menu_item_id: item.menu_item_id,
          outlet_id: item.outlet_id,
          auto_unavailable: shouldBeUnavailable,
          is_available: true,
          price_override: null,
        },
      });

      // Emit socket event for real-time UI updates
      const io = getIO();
      if (io) {
        emitToOutletManagers(io, outletId, 'item:availability_changed', {
          menuItemId: item.menu_item_id,
          outletId: item.outlet_id,
          available: !shouldBeUnavailable,
          autoUnavailable: shouldBeUnavailable,
          reason: shouldBeUnavailable ? 'out_of_stock' : 'restocked',
        });
      }
    }
  }
}

/**
 * Checks all ingredients at an outlet and updates auto_unavailable for affected menu items.
 * Called after restock to potentially re-enable items.
 */
export async function checkAndUpdateAllAutoUnavailable(
  tx: TransactionClient,
  outletId: string,
): Promise<void> {
  // Get all ingredients that have stock at this outlet
  const stocks = await tx.outletStock.findMany({
    where: { outlet_id: outletId },
    select: { ingredient_id: true, quantity: true },
  });

  for (const stock of stocks) {
    await updateAutoUnavailableForIngredient(
      tx,
      outletId,
      stock.ingredient_id,
      Number(stock.quantity),
    );
  }
}
