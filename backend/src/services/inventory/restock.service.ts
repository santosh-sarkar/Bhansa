import { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getManageableOutletIds, type StaffActor } from '@/services/staff/access';
import { checkAndUpdateAllAutoUnavailable } from '@/services/inventory/auto-unavailable.service';

export interface RestockResult {
  outlet_id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  quantity_before: string;
  quantity_added: string;
  quantity_after: string;
  movement_id: string;
}

/**
 * Records a restock for an ingredient at an outlet.
 * Updates the outlet stock quantity and creates a stock movement record.
 */
export async function recordRestock(
  actor: StaffActor,
  outletId: string,
  input: {
    ingredient_id: string;
    quantity: string;
    unit_cost?: string | null;
    supplier?: string | null;
    reason?: string | null;
  },
): Promise<RestockResult> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify outlet exists and user has access
  const outlet = await prisma.outlet.findFirst({
    where: {
      id: outletId,
      organization_id: actor.organization_id,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!outlet) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Check outlet access - requires inventory.restock permission
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', `No access to outlet ${outletId}`, 403);
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

  // Validate quantity is positive
  const quantity = new Prisma.Decimal(input.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new AppError('VALIDATION_ERROR', 'Quantity must be greater than 0', 400);
  }

  // Perform restock in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Get current stock or create new
    const currentStock = await tx.outletStock.findUnique({
      where: {
        outlet_id_ingredient_id: {
          outlet_id: outletId,
          ingredient_id: input.ingredient_id,
        },
      },
    });

    const quantityBefore = currentStock?.quantity ?? new Prisma.Decimal(0);
    const quantityAfter = quantityBefore.add(quantity);

    // Upsert stock
    await tx.outletStock.upsert({
      where: {
        outlet_id_ingredient_id: {
          outlet_id: outletId,
          ingredient_id: input.ingredient_id,
        },
      },
      update: {
        quantity: quantityAfter,
      },
      create: {
        outlet_id: outletId,
        ingredient_id: input.ingredient_id,
        quantity: quantityAfter,
        low_threshold: 0,
      },
    });

    // Create stock movement record
    const movement = await tx.stockMovement.create({
      data: {
        outlet_id: outletId,
        ingredient_id: input.ingredient_id,
        type: 'restock',
        quantity_delta: quantity,
        balance_after: quantityAfter,
        unit_cost: input.unit_cost ? new Prisma.Decimal(input.unit_cost) : null,
        supplier: input.supplier ?? null,
        reason: input.reason ?? `Restock of ${ingredient.name}`,
        performed_by: actor.id,
      },
    });

    // Update auto_unavailable for all menu items at this outlet (recovery)
    await checkAndUpdateAllAutoUnavailable(tx, outletId);

    return {
      movement,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
    };
  });

  // Helper to format decimal to 3 decimal places
  const formatQty = (d: Prisma.Decimal) => d.toFixed(3);

  return {
    outlet_id: outletId,
    ingredient_id: input.ingredient_id,
    ingredient_name: ingredient.name,
    ingredient_unit: ingredient.unit,
    quantity_before: formatQty(result.quantity_before),
    quantity_added: formatQty(quantity),
    quantity_after: formatQty(result.quantity_after),
    movement_id: result.movement.id,
  };
}
