import type { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getManageableOutletIds, type StaffActor } from '@/services/staff/access';

export interface EffectiveMenuCategory {
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
}

export interface EffectiveMenu {
  categories: EffectiveMenuCategory[];
}

export interface MenuCategoryListItem {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  _count?: {
    menuItems: number;
  };
}

export interface MenuCategoryDetail extends MenuCategoryListItem {
  menuItems?: Array<{
    id: string;
    name: string;
    base_price: Prisma.Decimal;
    is_active: boolean;
  }>;
}

export interface PaginatedCategories {
  categories: MenuCategoryListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Lists menu categories for an organization.
 * Organization-wide access (Owner) sees all categories.
 * Managers see categories for outlets they manage.
 */
export async function listCategories(
  actor: StaffActor,
  filters: { page: number; limit: number; is_active?: boolean; search?: string },
): Promise<PaginatedCategories> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Menu categories are organization-level, so we just check org membership
  // (permission check is done in middleware)

  const where: Record<string, unknown> = {
    organization_id: actor.organization_id,
  };

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  // If not organization-wide, we still show all categories since they're org-level
  // but we could filter by outlets if needed in the future

  const [categories, total] = await Promise.all([
    prisma.menuCategory.findMany({
      where,
      select: {
        id: true,
        organization_id: true,
        name: true,
        sort_order: true,
        is_active: true,
        _count: {
          select: { menuItems: true },
        },
      },
      orderBy: { sort_order: 'asc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.menuCategory.count({ where }),
  ]);

  return {
    categories,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Gets a single menu category by ID.
 */
export async function getCategory(
  actor: StaffActor,
  categoryId: string,
): Promise<MenuCategoryDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const category = await prisma.menuCategory.findFirst({
    where: {
      id: categoryId,
      organization_id: actor.organization_id,
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      sort_order: true,
      is_active: true,
      menuItems: {
        where: { is_active: true, deleted_at: null },
        select: {
          id: true,
          name: true,
          base_price: true,
          is_active: true,
        },
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  if (!category) {
    throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  return category;
}

/**
 * Creates a new menu category for an organization.
 * Requires menu.edit permission (Owner or Manager with menu permissions).
 */
export async function createCategory(
  actor: StaffActor,
  input: { name: string; sort_order?: number },
): Promise<MenuCategoryDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage categories', 403);
  }

  // Check if category with same name exists in organization
  const existing = await prisma.menuCategory.findFirst({
    where: {
      organization_id: actor.organization_id,
      name: input.name,
    },
  });

  if (existing) {
    throw new AppError('CONFLICT', 'Category with this name already exists', 409);
  }

  const category = await prisma.menuCategory.create({
    data: {
      organization_id: actor.organization_id,
      name: input.name,
      sort_order: input.sort_order ?? 0,
      is_active: true,
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      sort_order: true,
      is_active: true,
      menuItems: {
        where: { is_active: true, deleted_at: null },
        select: {
          id: true,
          name: true,
          base_price: true,
          is_active: true,
        },
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  return category;
}

/**
 * Updates a menu category.
 */
export async function updateCategory(
  actor: StaffActor,
  categoryId: string,
  input: { name?: string; sort_order?: number; is_active?: boolean },
): Promise<MenuCategoryDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage categories', 403);
  }

  // Check if category exists in organization
  const existing = await prisma.menuCategory.findFirst({
    where: {
      id: categoryId,
      organization_id: actor.organization_id,
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  // Check name uniqueness if changing
  if (input.name !== undefined && input.name !== existing.name) {
    const duplicate = await prisma.menuCategory.findFirst({
      where: {
        organization_id: actor.organization_id,
        name: input.name,
        id: { not: categoryId },
      },
    });

    if (duplicate) {
      throw new AppError('CONFLICT', 'Category with this name already exists', 409);
    }
  }

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.is_active !== undefined) data.is_active = input.is_active;

  const category = await prisma.menuCategory.update({
    where: { id: categoryId },
    data,
    select: {
      id: true,
      organization_id: true,
      name: true,
      sort_order: true,
      is_active: true,
      menuItems: {
        where: { is_active: true, deleted_at: null },
        select: {
          id: true,
          name: true,
          base_price: true,
          is_active: true,
        },
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  return category;
}

/**
 * Deletes (soft delete) a menu category.
 * Only allowed if category has no active menu items.
 */
export async function deleteCategory(
  actor: StaffActor,
  categoryId: string,
): Promise<MenuCategoryDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage categories', 403);
  }

  // Check if category exists in organization
  const existing = await prisma.menuCategory.findFirst({
    where: {
      id: categoryId,
      organization_id: actor.organization_id,
    },
    include: {
      menuItems: {
        where: { is_active: true, deleted_at: null },
        select: { id: true },
      },
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  // Check if category has active menu items
  if (existing.menuItems.length > 0) {
    throw new AppError(
      'CONFLICT',
      'Cannot delete category with active menu items. Move or delete items first.',
      409,
    );
  }

  // Soft delete by setting is_active to false
  const category = await prisma.menuCategory.update({
    where: { id: categoryId },
    data: { is_active: false },
    select: {
      id: true,
      organization_id: true,
      name: true,
      sort_order: true,
      is_active: true,
      menuItems: {
        where: { is_active: true, deleted_at: null },
        select: {
          id: true,
          name: true,
          base_price: true,
          is_active: true,
        },
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  return category;
}

/**
 * Gets the effective menu for an outlet.
 * Returns categories with their items, including outlet-specific price overrides.
 * Only returns active categories and active items.
 */
export async function getEffectiveMenuForOutlet(outletId: string): Promise<EffectiveMenu> {
  const dbCategories = await prisma.menuCategory.findMany({
    where: {
      organization: {
        outlets: {
          some: { id: outletId },
        },
      },
      is_active: true,
    },
    include: {
      menuItems: {
        where: {
          is_active: true,
          deleted_at: null,
        },
        include: {
          outletOverrides: {
            where: { outlet_id: outletId },
            select: {
              price_override: true,
              is_available: true,
            },
          },
        },
        orderBy: { sort_order: 'asc' },
      },
    },
    orderBy: { sort_order: 'asc' },
  });

  const categories: EffectiveMenuCategory[] = [];

  for (const category of dbCategories) {
    const items = category.menuItems
      .filter((item) => item.is_active)
      .map((item) => {
        const override = item.outletOverrides[0];
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          base_price: item.base_price.toString(),
          is_active: item.is_active,
          image_url: item.image_url,
          override_price: override?.price_override?.toString() ?? null,
        };
      });

    if (items.length > 0) {
      categories.push({
        id: category.id,
        name: category.name,
        sort_order: category.sort_order,
        items,
      });
    }
  }

  return { categories };
}
