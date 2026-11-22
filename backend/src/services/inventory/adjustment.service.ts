import { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';

export interface AdjustmentResult {
  outlet_id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  quantity_before: string;
  quantity_delta: string;
  quantity_after: string;
  movement_id: string;
}

/**
 * Records a stock adjustment (positive or negative) for an ingredient at an outlet.
 * Updates the outlet stock quantity and creates a stock movement record with type 'adjustment'.
 */
export async function recordAdjustment(
  actor: StaffActor,
  outletId: string,
  input: { ingredient_id: string; quantity: string; unit_cost?: string | null; reason: string },
): Promise<AdjustmentResult> {
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

  // Check outlet access - Owner, Manager, Kitchen can adjust
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
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

  // Validate quantity (can be positive or negative for adjustment)
  const delta = new Prisma.Decimal(input.quantity);
  if (delta.equals(0)) {
    throw new AppError('VALIDATION_ERROR', 'Quantity must not be zero', 400);
  }

  // Perform adjustment in transaction
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
    const quantityAfter = quantityBefore.add(delta);

    // Ensure quantity doesn't go negative
    if (quantityAfter.lessThan(0)) {
      throw new AppError('VALIDATION_ERROR', 'Adjustment would result in negative stock', 400);
    }

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
        type: 'adjustment',
        quantity_delta: delta,
        balance_after: quantityAfter,
        unit_cost: input.unit_cost ? new Prisma.Decimal(input.unit_cost) : null,
        supplier: null,
        reason: input.reason,
        performed_by: actor.id,
      },
    });

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
    quantity_delta: formatQty(delta),
    quantity_after: formatQty(result.quantity_after),
    movement_id: result.movement.id,
  };
}

/**
 * Records a stock wastage for an ingredient at an outlet.
 * Updates the outlet stock quantity and creates a stock movement record with type 'wastage'.
 */
export async function recordWastage(
  actor: StaffActor,
  outletId: string,
  input: { ingredient_id: string; quantity: string; unit_cost?: string | null; reason: string },
): Promise<AdjustmentResult> {
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

  // Check outlet access - Owner, Manager, Kitchen can record wastage
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
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

  // Validate quantity is positive for wastage
  const delta = new Prisma.Decimal(input.quantity);
  if (delta.lessThanOrEqualTo(0)) {
    throw new AppError('VALIDATION_ERROR', 'Quantity must be greater than 0 for wastage', 400);
  }

  // Wastage is always negative delta
  const negativeDelta = delta.negated();

  // Perform wastage in transaction
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
    const quantityAfter = quantityBefore.add(negativeDelta);

    // Ensure quantity doesn't go negative
    if (quantityAfter.lessThan(0)) {
      throw new AppError('VALIDATION_ERROR', 'Wastage would result in negative stock', 400);
    }

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
        type: 'wastage',
        quantity_delta: negativeDelta,
        balance_after: quantityAfter,
        unit_cost: input.unit_cost ? new Prisma.Decimal(input.unit_cost) : null,
        supplier: null,
        reason: input.reason,
        performed_by: actor.id,
      },
    });

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
    quantity_delta: formatQty(negativeDelta),
    quantity_after: formatQty(result.quantity_after),
    movement_id: result.movement.id,
  };
}
