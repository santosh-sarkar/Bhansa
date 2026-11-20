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

export interface MenuItemListItem {
  id: string;
  organization_id: string;
  category_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: Prisma.Decimal;
  is_veg: boolean | null;
  prep_time_min: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  _count?: {
    options: number;
    outletOverrides: number;
  };
}

export interface MenuItemDetail extends MenuItemListItem {
  options?: Array<{
    id: string;
    kind: string;
    name: string;
    price_delta: Prisma.Decimal;
    is_active: boolean;
  }>;
  outletOverrides?: Array<{
    menu_item_id: string;
    outlet_id: string;
    price_override: Prisma.Decimal | null;
    is_available: boolean;
    auto_unavailable: boolean;
  }>;
  category?: {
    id: string;
    name: string;
    is_active: boolean;
  };
}

export interface PaginatedMenuItems {
  items: MenuItemListItem[];
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

/**
 * Lists menu items for an organization.
 * Organization-wide access (Owner) sees all items.
 * Managers see items for outlets they manage.
 */
export async function listMenuItems(
  actor: StaffActor,
  filters: {
    page: number;
    limit: number;
    category_id?: string;
    is_active?: boolean;
    is_veg?: boolean;
    search?: string;
  },
): Promise<PaginatedMenuItems> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Menu items are organization-level, permission check is done in middleware

  const where: Record<string, unknown> = {
    organization_id: actor.organization_id,
  };

  if (filters.category_id) {
    where.category_id = filters.category_id;
  }

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  if (filters.is_veg !== undefined) {
    where.is_veg = filters.is_veg;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.menuItem.findMany({
      where,
      select: {
        id: true,
        organization_id: true,
        category_id: true,
        name: true,
        description: true,
        image_url: true,
        base_price: true,
        is_veg: true,
        prep_time_min: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        _count: {
          select: { options: true, outletOverrides: true },
        },
      },
      orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.menuItem.count({ where }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Gets a single menu item by ID.
 */
export async function getMenuItem(actor: StaffActor, itemId: string): Promise<MenuItemDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const item = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      organization_id: actor.organization_id,
    },
    select: {
      id: true,
      organization_id: true,
      category_id: true,
      name: true,
      description: true,
      image_url: true,
      base_price: true,
      is_veg: true,
      prep_time_min: true,
      is_active: true,
      sort_order: true,
      created_at: true,
      options: {
        where: { is_active: true },
        select: {
          id: true,
          kind: true,
          name: true,
          price_delta: true,
          is_active: true,
        },
        orderBy: { id: 'asc' },
      },
      outletOverrides: {
        select: {
          menu_item_id: true,
          outlet_id: true,
          price_override: true,
          is_available: true,
          auto_unavailable: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          is_active: true,
        },
      },
    },
  });

  if (!item) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  return item;
}

/**
 * Creates a new menu item for an organization.
 * Requires menu.edit permission.
 * Plan-gated by max_menu_items limit.
 */
export async function createMenuItem(
  actor: StaffActor,
  input: {
    category_id: string;
    name: string;
    description?: string;
    image_url?: string;
    base_price: number;
    is_veg?: boolean;
    prep_time_min?: number;
    sort_order?: number;
  },
): Promise<MenuItemDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage menu items', 403);
  }

  // Verify category exists in organization
  const category = await prisma.menuCategory.findFirst({
    where: {
      id: input.category_id,
      organization_id: actor.organization_id,
    },
  });

  if (!category) {
    throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  // Check if item with same name exists in same category
  const existing = await prisma.menuItem.findFirst({
    where: {
      organization_id: actor.organization_id,
      category_id: input.category_id,
      name: input.name,
    },
  });

  if (existing) {
    throw new AppError('CONFLICT', 'Menu item with this name already exists in this category', 409);
  }

  const item = await prisma.menuItem.create({
    data: {
      organization_id: actor.organization_id,
      category_id: input.category_id,
      name: input.name,
      description: input.description ?? null,
      image_url: input.image_url ?? null,
      base_price: input.base_price,
      is_veg: input.is_veg ?? null,
      prep_time_min: input.prep_time_min ?? null,
      sort_order: input.sort_order ?? 0,
      is_active: true,
    },
    select: {
      id: true,
      organization_id: true,
      category_id: true,
      name: true,
      description: true,
      image_url: true,
      base_price: true,
      is_veg: true,
      prep_time_min: true,
      is_active: true,
      sort_order: true,
      created_at: true,
      options: {
        where: { is_active: true },
        select: {
          id: true,
          kind: true,
          name: true,
          price_delta: true,
          is_active: true,
        },
        orderBy: { id: 'asc' },
      },
      outletOverrides: {
        select: {
          menu_item_id: true,
          outlet_id: true,
          price_override: true,
          is_available: true,
          auto_unavailable: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          is_active: true,
        },
      },
    },
  });

  return item;
}

/**
 * Updates a menu item.
 */
export async function updateMenuItem(
  actor: StaffActor,
  itemId: string,
  input: {
    category_id?: string;
    name?: string;
    description?: string | null;
    image_url?: string | null;
    base_price?: number;
    is_veg?: boolean;
    prep_time_min?: number;
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<MenuItemDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage menu items', 403);
  }

  // Check if item exists in organization
  const existing = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      organization_id: actor.organization_id,
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Verify category exists if changing
  if (input.category_id !== undefined && input.category_id !== existing.category_id) {
    const category = await prisma.menuCategory.findFirst({
      where: {
        id: input.category_id,
        organization_id: actor.organization_id,
      },
    });

    if (!category) {
      throw new AppError('NOT_FOUND', 'Category not found', 404);
    }

    // Check name uniqueness in new category
    if (input.name !== undefined && input.name !== existing.name) {
      const duplicate = await prisma.menuItem.findFirst({
        where: {
          organization_id: actor.organization_id,
          category_id: input.category_id,
          name: input.name,
          id: { not: itemId },
        },
      });

      if (duplicate) {
        throw new AppError(
          'CONFLICT',
          'Menu item with this name already exists in this category',
          409,
        );
      }
    }
  } else if (input.name !== undefined && input.name !== existing.name) {
    // Check name uniqueness in current category
    const duplicate = await prisma.menuItem.findFirst({
      where: {
        organization_id: actor.organization_id,
        category_id: existing.category_id,
        name: input.name,
        id: { not: itemId },
      },
    });

    if (duplicate) {
      throw new AppError(
        'CONFLICT',
        'Menu item with this name already exists in this category',
        409,
      );
    }
  }

  const data: Record<string, unknown> = {};

  if (input.category_id !== undefined) data.category_id = input.category_id;
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.image_url !== undefined) data.image_url = input.image_url;
  if (input.base_price !== undefined) data.base_price = input.base_price;
  if (input.is_veg !== undefined) data.is_veg = input.is_veg;
  if (input.prep_time_min !== undefined) data.prep_time_min = input.prep_time_min;
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.is_active !== undefined) data.is_active = input.is_active;

  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data,
    select: {
      id: true,
      organization_id: true,
      category_id: true,
      name: true,
      description: true,
      image_url: true,
      base_price: true,
      is_veg: true,
      prep_time_min: true,
      is_active: true,
      sort_order: true,
      created_at: true,
      options: {
        where: { is_active: true },
        select: {
          id: true,
          kind: true,
          name: true,
          price_delta: true,
          is_active: true,
        },
        orderBy: { id: 'asc' },
      },
      outletOverrides: {
        select: {
          menu_item_id: true,
          outlet_id: true,
          price_override: true,
          is_available: true,
          auto_unavailable: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          is_active: true,
        },
      },
    },
  });

  return item;
}

/**
 * Deletes (soft delete) a menu item.
 * Sets is_active=false and deleted_at.
 */
export async function deleteMenuItem(actor: StaffActor, itemId: string): Promise<MenuItemDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage menu items', 403);
  }

  // Check if item exists in organization
  const existing = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      organization_id: actor.organization_id,
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Soft delete by setting is_active=false and deleted_at
  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      is_active: false,
      deleted_at: new Date(),
    },
    select: {
      id: true,
      organization_id: true,
      category_id: true,
      name: true,
      description: true,
      image_url: true,
      base_price: true,
      is_veg: true,
      prep_time_min: true,
      is_active: true,
      sort_order: true,
      created_at: true,
      options: {
        where: { is_active: true },
        select: {
          id: true,
          kind: true,
          name: true,
          price_delta: true,
          is_active: true,
        },
        orderBy: { id: 'asc' },
      },
      outletOverrides: {
        select: {
          menu_item_id: true,
          outlet_id: true,
          price_override: true,
          is_available: true,
          auto_unavailable: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          is_active: true,
        },
      },
    },
  });

  return item;
}

/**
 * Lists menu item options for a menu item.
 * Only returns options for items in the actor's organization.
 */
export async function listMenuItemOptions(
  actor: StaffActor,
  menuItemId: string,
  filters: { page: number; limit: number; kind?: string; is_active?: boolean },
) {
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

  const where: Record<string, unknown> = {
    menu_item_id: menuItemId,
  };

  if (filters.kind) {
    where.kind = filters.kind;
  }

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  const [options, total] = await Promise.all([
    prisma.menuItemOption.findMany({
      where,
      select: {
        id: true,
        menu_item_id: true,
        kind: true,
        name: true,
        price_delta: true,
        is_active: true,
      },
      orderBy: { id: 'asc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.menuItemOption.count({ where }),
  ]);

  return {
    options,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Gets a single menu item option by ID.
 */
export async function getMenuItemOption(actor: StaffActor, menuItemId: string, optionId: string) {
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

  const option = await prisma.menuItemOption.findFirst({
    where: {
      id: optionId,
      menu_item_id: menuItemId,
    },
    select: {
      id: true,
      menu_item_id: true,
      kind: true,
      name: true,
      price_delta: true,
      is_active: true,
    },
  });

  if (!option) {
    throw new AppError('NOT_FOUND', 'Option not found', 404);
  }

  return option;
}

/**
 * Creates a new menu item option (variant or addon).
 * Requires menu.edit permission.
 */
export async function createMenuItemOption(
  actor: StaffActor,
  menuItemId: string,
  input: { kind: 'variant' | 'addon'; name: string; price_delta?: number },
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage menu items', 403);
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

  // Check if option with same name exists for this menu item
  const existing = await prisma.menuItemOption.findFirst({
    where: {
      menu_item_id: menuItemId,
      name: input.name,
    },
  });

  if (existing) {
    throw new AppError('CONFLICT', 'Option with this name already exists for this menu item', 409);
  }

  const option = await prisma.menuItemOption.create({
    data: {
      menu_item_id: menuItemId,
      kind: input.kind,
      name: input.name,
      price_delta: input.price_delta ?? 0,
      is_active: true,
    },
    select: {
      id: true,
      menu_item_id: true,
      kind: true,
      name: true,
      price_delta: true,
      is_active: true,
    },
  });

  return option;
}

/**
 * Updates a menu item option.
 */
export async function updateMenuItemOption(
  actor: StaffActor,
  menuItemId: string,
  optionId: string,
  input: { kind?: 'variant' | 'addon'; name?: string; price_delta?: number; is_active?: boolean },
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage menu items', 403);
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

  // Check if option exists
  const existing = await prisma.menuItemOption.findFirst({
    where: {
      id: optionId,
      menu_item_id: menuItemId,
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Option not found', 404);
  }

  // Check name uniqueness if changing
  if (input.name !== undefined && input.name !== existing.name) {
    const duplicate = await prisma.menuItemOption.findFirst({
      where: {
        menu_item_id: menuItemId,
        name: input.name,
        id: { not: optionId },
      },
    });

    if (duplicate) {
      throw new AppError(
        'CONFLICT',
        'Option with this name already exists for this menu item',
        409,
      );
    }
  }

  const data: Record<string, unknown> = {};

  if (input.kind !== undefined) data.kind = input.kind;
  if (input.name !== undefined) data.name = input.name;
  if (input.price_delta !== undefined) data.price_delta = input.price_delta;
  if (input.is_active !== undefined) data.is_active = input.is_active;

  const option = await prisma.menuItemOption.update({
    where: { id: optionId },
    data,
    select: {
      id: true,
      menu_item_id: true,
      kind: true,
      name: true,
      price_delta: true,
      is_active: true,
    },
  });

  return option;
}

/**
 * Deletes (soft delete) a menu item option.
 * Sets is_active=false.
 */
export async function deleteMenuItemOption(
  actor: StaffActor,
  menuItemId: string,
  optionId: string,
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    throw new AppError('FORBIDDEN', 'No outlet access to manage menu items', 403);
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

  // Check if option exists
  const existing = await prisma.menuItemOption.findFirst({
    where: {
      id: optionId,
      menu_item_id: menuItemId,
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Option not found', 404);
  }

  // Soft delete by setting is_active=false
  const option = await prisma.menuItemOption.update({
    where: { id: optionId },
    data: { is_active: false },
    select: {
      id: true,
      menu_item_id: true,
      kind: true,
      name: true,
      price_delta: true,
      is_active: true,
    },
  });

  return option;
}

/**
 * Gets all outlet overrides for a menu item.
 * Returns overrides only for outlets the actor has access to.
 */
export async function getMenuItemOutletOverrides(actor: StaffActor, itemId: string) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify menu item exists in organization
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      organization_id: actor.organization_id,
    },
    select: { id: true },
  });

  if (!menuItem) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Get manageable outlet IDs
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  const where: Record<string, unknown> = {
    menu_item_id: itemId,
  };

  if (!organizationWide && outletIds.length > 0) {
    where.outlet_id = { in: outletIds };
  }

  const overrides = await prisma.menuItemOutletOverride.findMany({
    where,
    select: {
      menu_item_id: true,
      outlet_id: true,
      price_override: true,
      is_available: true,
      auto_unavailable: true,
      outlet: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      outlet: {
        name: 'asc',
      },
    },
  });

  // Format price_override as string with 2 decimal places
  return overrides.map((override) => ({
    ...override,
    price_override: override.price_override ? override.price_override.toFixed(2) : null,
  }));
}

/**
 * Updates outlet overrides for a menu item (bulk upsert).
 * Owner can update overrides for any outlet in organization.
 * Manager can only update overrides for assigned outlets.
 */
export async function updateMenuItemOutletOverrides(
  actor: StaffActor,
  itemId: string,
  overrides: Array<{
    outlet_id: string;
    price_override?: number | null;
    is_available?: boolean;
    auto_unavailable?: boolean;
  }>,
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify menu item exists in organization
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      organization_id: actor.organization_id,
    },
    select: { id: true },
  });

  if (!menuItem) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404);
  }

  // Get manageable outlet IDs
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  // Validate all outlet IDs are accessible
  for (const override of overrides) {
    if (!organizationWide && !outletIds.includes(override.outlet_id)) {
      throw new AppError('FORBIDDEN', `No access to outlet ${override.outlet_id}`, 403);
    }

    // Verify outlet exists in organization
    const outlet = await prisma.outlet.findFirst({
      where: {
        id: override.outlet_id,
        organization_id: actor.organization_id,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!outlet) {
      throw new AppError('NOT_FOUND', `Outlet ${override.outlet_id} not found`, 404);
    }
  }

  // Perform bulk upsert
  await prisma.$transaction(
    overrides.map((override) =>
      prisma.menuItemOutletOverride.upsert({
        where: {
          menu_item_id_outlet_id: {
            menu_item_id: itemId,
            outlet_id: override.outlet_id,
          },
        },
        update: {
          price_override: override.price_override ?? null,
          is_available: override.is_available ?? true,
          auto_unavailable: override.auto_unavailable ?? false,
        },
        create: {
          menu_item_id: itemId,
          outlet_id: override.outlet_id,
          price_override: override.price_override ?? null,
          is_available: override.is_available ?? true,
          auto_unavailable: override.auto_unavailable ?? false,
        },
      }),
    ),
  );

  // Return updated overrides with outlet info
  const updatedOverrides = await prisma.menuItemOutletOverride.findMany({
    where: {
      menu_item_id: itemId,
      outlet_id: { in: overrides.map((o) => o.outlet_id) },
    },
    select: {
      menu_item_id: true,
      outlet_id: true,
      price_override: true,
      is_available: true,
      auto_unavailable: true,
      outlet: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      outlet: {
        name: 'asc',
      },
    },
  });

  // Format price_override as string with 2 decimal places
  return updatedOverrides.map((override) => ({
    ...override,
    price_override: override.price_override ? override.price_override.toFixed(2) : null,
  }));
}
