import { prisma } from '@/lib/prisma';

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
