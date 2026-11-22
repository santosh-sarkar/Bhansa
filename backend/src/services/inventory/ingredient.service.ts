import type { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getManageableOutletIds, type StaffActor } from '@/services/staff/access';

export interface IngredientListItem {
  id: string;
  organization_id: string;
  name: string;
  unit: string;
  default_cost: Prisma.Decimal | null;
  is_active: boolean;
  _count?: {
    outletStock: number;
    recipeItems: number;
  };
}

export interface IngredientDetail extends IngredientListItem {
  outletStock?: Array<{
    outlet_id: string;
    quantity: Prisma.Decimal;
    low_threshold: Prisma.Decimal;
    outlet: {
      id: string;
      name: string;
    };
  }>;
}

export interface PaginatedIngredients {
  ingredients: IngredientListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Lists ingredients for an organization.
 * Organization-wide access (Owner) sees all ingredients.
 * Managers see ingredients for outlets they manage.
 */
export async function listIngredients(
  actor: StaffActor,
  filters: { page: number; limit: number; is_active?: boolean; search?: string },
): Promise<PaginatedIngredients> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Ingredients are organization-level, permission check is done in middleware
  // but we verify manageable outlet access for managers
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage ingredients', 403);
  }

  const where: Record<string, unknown> = {
    organization_id: actor.organization_id,
  };

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const [ingredients, total] = await Promise.all([
    prisma.ingredient.findMany({
      where,
      select: {
        id: true,
        organization_id: true,
        name: true,
        unit: true,
        default_cost: true,
        is_active: true,
        _count: {
          select: { outletStock: true, recipeItems: true },
        },
      },
      orderBy: { name: 'asc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.ingredient.count({ where }),
  ]);

  return {
    ingredients,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Gets a single ingredient by ID.
 */
export async function getIngredient(
  actor: StaffActor,
  ingredientId: string,
): Promise<IngredientDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to view ingredients', 403);
  }

  const ingredient = await prisma.ingredient.findFirst({
    where: {
      id: ingredientId,
      organization_id: actor.organization_id,
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      unit: true,
      default_cost: true,
      is_active: true,
      outletStock: {
        select: {
          outlet_id: true,
          quantity: true,
          low_threshold: true,
          outlet: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!ingredient) {
    throw new AppError('NOT_FOUND', 'Ingredient not found', 404);
  }

  return ingredient;
}

/**
 * Creates a new ingredient for an organization.
 * Requires inventory.manage permission (Owner or Manager with inventory permissions).
 */
export async function createIngredient(
  actor: StaffActor,
  input: { name: string; unit: string; default_cost?: string | null; is_active?: boolean },
): Promise<IngredientDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage ingredients', 403);
  }

  // Check if ingredient with same name exists in organization
  const existing = await prisma.ingredient.findFirst({
    where: {
      organization_id: actor.organization_id,
      name: input.name,
    },
  });

  if (existing) {
    throw new AppError('CONFLICT', 'Ingredient with this name already exists', 409);
  }

  const ingredient = await prisma.ingredient.create({
    data: {
      organization_id: actor.organization_id,
      name: input.name,
      unit: input.unit,
      default_cost: input.default_cost ?? null,
      is_active: input.is_active ?? true,
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      unit: true,
      default_cost: true,
      is_active: true,
    },
  });

  return ingredient;
}

/**
 * Updates an ingredient.
 */
export async function updateIngredient(
  actor: StaffActor,
  ingredientId: string,
  input: { name?: string; unit?: string; default_cost?: string | null; is_active?: boolean },
): Promise<IngredientDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage ingredients', 403);
  }

  // Check if ingredient exists in organization
  const existing = await prisma.ingredient.findFirst({
    where: {
      id: ingredientId,
      organization_id: actor.organization_id,
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Ingredient not found', 404);
  }

  // Check name uniqueness if changing
  if (input.name !== undefined && input.name !== existing.name) {
    const duplicate = await prisma.ingredient.findFirst({
      where: {
        organization_id: actor.organization_id,
        name: input.name,
        id: { not: ingredientId },
      },
    });

    if (duplicate) {
      throw new AppError('CONFLICT', 'Ingredient with this name already exists', 409);
    }
  }

  const ingredient = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      name: input.name,
      unit: input.unit,
      default_cost: input.default_cost,
      is_active: input.is_active,
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      unit: true,
      default_cost: true,
      is_active: true,
      outletStock: {
        select: {
          outlet_id: true,
          quantity: true,
          low_threshold: true,
          outlet: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return ingredient;
}

/**
 * Deletes (soft delete) an ingredient.
 * Only allowed if ingredient has no outlet stock or recipe items.
 */
export async function deleteIngredient(
  actor: StaffActor,
  ingredientId: string,
): Promise<IngredientDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage ingredients', 403);
  }

  // Check if ingredient exists in organization
  const existing = await prisma.ingredient.findFirst({
    where: {
      id: ingredientId,
      organization_id: actor.organization_id,
    },
    include: {
      outletStock: { select: { outlet_id: true } },
      recipeItems: { select: { menu_item_id: true } },
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Ingredient not found', 404);
  }

  // Check if ingredient has outlet stock or recipe items
  if (existing.outletStock.length > 0 || existing.recipeItems.length > 0) {
    throw new AppError(
      'CONFLICT',
      'Cannot delete ingredient with existing stock records or recipes. Remove those first.',
      409,
    );
  }

  // Soft delete by setting is_active to false
  const ingredient = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: { is_active: false },
    select: {
      id: true,
      organization_id: true,
      name: true,
      unit: true,
      default_cost: true,
      is_active: true,
    },
  });

  return ingredient;
}
