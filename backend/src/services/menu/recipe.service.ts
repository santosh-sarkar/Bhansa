import type { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getManageableOutletIds, type StaffActor } from '@/services/staff/access';

export interface RecipeItemListItem {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: Prisma.Decimal;
}

export interface RecipeItemDetail extends RecipeItemListItem {
  menu_item_id: string;
  menu_item_name: string;
}

/**
 * Lists recipe items for a menu item.
 */
export async function listRecipeItems(
  actor: StaffActor,
  menuItemId: string,
): Promise<RecipeItemListItem[]> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify menu item exists in organization
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      organization_id: actor.organization_id,
    },
    select: { id: true },
  });

  if (!menuItem) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Check permission
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage recipes', 403);
  }

  const recipeItems = await prisma.recipeItem.findMany({
    where: { menu_item_id: menuItemId },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
    orderBy: { ingredient: { name: 'asc' } },
  });

  return recipeItems.map((item) => ({
    ingredient_id: item.ingredient_id,
    ingredient_name: item.ingredient.name,
    ingredient_unit: item.ingredient.unit,
    quantity: item.quantity,
  }));
}

/**
 * Gets a single recipe item for a menu item.
 */
export async function getRecipeItem(
  actor: StaffActor,
  menuItemId: string,
  ingredientId: string,
): Promise<RecipeItemDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify menu item exists in organization
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      organization_id: actor.organization_id,
    },
    select: { id: true, name: true },
  });

  if (!menuItem) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Check permission
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage recipes', 403);
  }

  const recipeItem = await prisma.recipeItem.findUnique({
    where: {
      menu_item_id_ingredient_id: {
        menu_item_id: menuItemId,
        ingredient_id: ingredientId,
      },
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
  });

  if (!recipeItem) {
    throw new AppError('NOT_FOUND', 'Recipe item not found', 404);
  }

  return {
    menu_item_id: recipeItem.menu_item_id,
    menu_item_name: menuItem.name,
    ingredient_id: recipeItem.ingredient_id,
    ingredient_name: recipeItem.ingredient.name,
    ingredient_unit: recipeItem.ingredient.unit,
    quantity: recipeItem.quantity,
  };
}

/**
 * Creates a new recipe item for a menu item.
 */
export async function createRecipeItem(
  actor: StaffActor,
  menuItemId: string,
  input: { ingredient_id: string; quantity: string },
): Promise<RecipeItemDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify menu item exists in organization
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      organization_id: actor.organization_id,
    },
    select: { id: true, name: true },
  });

  if (!menuItem) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Check permission
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage recipes', 403);
  }

  // Verify ingredient exists in organization
  const ingredient = await prisma.ingredient.findFirst({
    where: {
      id: input.ingredient_id,
      organization_id: actor.organization_id,
    },
    select: { id: true, name: true, unit: true },
  });

  if (!ingredient) {
    throw new AppError('NOT_FOUND', 'Ingredient not found', 404);
  }

  // Check if recipe item already exists
  const existing = await prisma.recipeItem.findUnique({
    where: {
      menu_item_id_ingredient_id: {
        menu_item_id: menuItemId,
        ingredient_id: input.ingredient_id,
      },
    },
  });

  if (existing) {
    throw new AppError('CONFLICT', 'Recipe item for this ingredient already exists', 409);
  }

  const recipeItem = await prisma.recipeItem.create({
    data: {
      menu_item_id: menuItemId,
      ingredient_id: input.ingredient_id,
      quantity: input.quantity,
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
  });

  return {
    menu_item_id: recipeItem.menu_item_id,
    menu_item_name: menuItem.name,
    ingredient_id: recipeItem.ingredient_id,
    ingredient_name: recipeItem.ingredient.name,
    ingredient_unit: recipeItem.ingredient.unit,
    quantity: recipeItem.quantity,
  };
}

/**
 * Updates a recipe item for a menu item.
 */
export async function updateRecipeItem(
  actor: StaffActor,
  menuItemId: string,
  ingredientId: string,
  input: { quantity?: string },
): Promise<RecipeItemDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify menu item exists in organization
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      organization_id: actor.organization_id,
    },
    select: { id: true, name: true },
  });

  if (!menuItem) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Check permission
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage recipes', 403);
  }

  // Verify recipe item exists
  const existing = await prisma.recipeItem.findUnique({
    where: {
      menu_item_id_ingredient_id: {
        menu_item_id: menuItemId,
        ingredient_id: ingredientId,
      },
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Recipe item not found', 404);
  }

  const recipeItem = await prisma.recipeItem.update({
    where: {
      menu_item_id_ingredient_id: {
        menu_item_id: menuItemId,
        ingredient_id: ingredientId,
      },
    },
    data: {
      quantity: input.quantity,
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
  });

  return {
    menu_item_id: recipeItem.menu_item_id,
    menu_item_name: menuItem.name,
    ingredient_id: recipeItem.ingredient_id,
    ingredient_name: recipeItem.ingredient.name,
    ingredient_unit: recipeItem.ingredient.unit,
    quantity: recipeItem.quantity,
  };
}

/**
 * Deletes a recipe item for a menu item.
 */
export async function deleteRecipeItem(
  actor: StaffActor,
  menuItemId: string,
  ingredientId: string,
): Promise<RecipeItemDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify menu item exists in organization
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      organization_id: actor.organization_id,
    },
    select: { id: true, name: true },
  });

  if (!menuItem) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Check permission
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage recipes', 403);
  }

  // Verify recipe item exists
  const existing = await prisma.recipeItem.findUnique({
    where: {
      menu_item_id_ingredient_id: {
        menu_item_id: menuItemId,
        ingredient_id: ingredientId,
      },
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Recipe item not found', 404);
  }

  await prisma.recipeItem.delete({
    where: {
      menu_item_id_ingredient_id: {
        menu_item_id: menuItemId,
        ingredient_id: ingredientId,
      },
    },
  });

  return {
    menu_item_id: existing.menu_item_id,
    menu_item_name: menuItem.name,
    ingredient_id: existing.ingredient_id,
    ingredient_name: existing.ingredient.name,
    ingredient_unit: existing.ingredient.unit,
    quantity: existing.quantity,
  };
}

/**
 * Bulk upserts recipe items for a menu item.
 * Replaces all existing recipe items with the new list.
 */
export async function bulkUpsertRecipe(
  actor: StaffActor,
  menuItemId: string,
  items: Array<{ ingredient_id: string; quantity: string }>,
): Promise<RecipeItemListItem[]> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify menu item exists in organization
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      organization_id: actor.organization_id,
    },
    select: { id: true },
  });

  if (!menuItem) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Check permission
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage recipes', 403);
  }

  // Verify all ingredients exist in organization
  const ingredientIds = items.map((i) => i.ingredient_id);
  const ingredients = await prisma.ingredient.findMany({
    where: {
      id: { in: ingredientIds },
      organization_id: actor.organization_id,
    },
    select: { id: true },
  });

  if (ingredients.length !== ingredientIds.length) {
    const foundIds = new Set(ingredients.map((i) => i.id));
    const missingIds = ingredientIds.filter((id) => !foundIds.has(id));
    throw new AppError('NOT_FOUND', `Ingredients not found: ${missingIds.join(', ')}`, 404);
  }

  // Replace all recipe items in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Delete existing recipe items
    await tx.recipeItem.deleteMany({
      where: { menu_item_id: menuItemId },
    });

    // Create new recipe items
    if (items.length > 0) {
      await tx.recipeItem.createMany({
        data: items.map((item) => ({
          menu_item_id: menuItemId,
          ingredient_id: item.ingredient_id,
          quantity: item.quantity,
        })),
      });
    }

    // Return the new recipe items with ingredient details
    const newItems = await tx.recipeItem.findMany({
      where: { menu_item_id: menuItemId },
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true },
        },
      },
      orderBy: { ingredient: { name: 'asc' } },
    });

    return newItems.map((item) => ({
      ingredient_id: item.ingredient_id,
      ingredient_name: item.ingredient.name,
      ingredient_unit: item.ingredient.unit,
      quantity: item.quantity,
    }));
  });

  return result;
}
