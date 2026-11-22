import { beforeAll, describe, expect, it, jest } from '@jest/globals';

import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../helpers/database';
import { createIsolatedTenants } from '../../helpers/tenant';
import { createTrialSubscription } from '../../helpers/tenant';
import { deductStockForOrder } from '@/services/inventory/stock-deduction.service';

describe('Concurrency: Stock Deduction Race Conditions', () => {
  // Increase timeout for slow database operations
  jest.setTimeout(120000);
  let tenantA: {
    organization: { id: string };
    outlet: { id: string };
    users: { owner: { id: string } };
  };
  let ingredientId: string;
  let menuItemId: string;
  let categoryId: string;
  let testUserId: string;

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: a } = await createIsolatedTenants();
    tenantA = a;

    // Create subscriptions
    await createTrialSubscription(tenantA.organization.id);

    // Use owner's user ID for performed_by
    testUserId = tenantA.users.owner.id;

    // Create ingredient
    const ingredient = await prisma.ingredient.create({
      data: {
        organization_id: tenantA.organization.id,
        name: 'Limited Ingredient',
        unit: 'kg',
      },
    });
    ingredientId = ingredient.id;

    // Stock: 10 units available (to test concurrent deductions without hitting zero)
    await prisma.outletStock.create({
      data: {
        outlet_id: tenantA.outlet.id,
        ingredient_id: ingredientId,
        quantity: 10,
        low_threshold: 0,
      },
    });

    // Create category first
    const category = await prisma.menuCategory.create({
      data: {
        organization_id: tenantA.organization.id,
        name: 'Test Category',
        sort_order: 1,
      },
    });
    categoryId = category.id;

    // Create menu item
    const menuItem = await prisma.menuItem.create({
      data: {
        organization_id: tenantA.organization.id,
        category_id: categoryId,
        name: 'Test Dish',
        base_price: 100,
        is_active: true,
      },
    });
    menuItemId = menuItem.id;

    // Recipe requires 1 unit of the ingredient
    await prisma.recipeItem.create({
      data: {
        menu_item_id: menuItemId,
        ingredient_id: ingredientId,
        quantity: 1,
      },
    });
  });

  it('concurrent deductions should not lose updates (lost update prevention)', async () => {
    // Reset stock to 10 before test
    await prisma.outletStock.update({
      where: {
        outlet_id_ingredient_id: {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredientId,
        },
      },
      data: { quantity: 10 },
    });

    // Create multiple orders in the database
    const orderIds = Array.from({ length: 3 }, (_, i) => `${(i + 1).toString().padStart(32, '1')}`);
    const itemIds = Array.from({ length: 3 }, (_, i) => `${(i + 1).toString().padStart(32, 'a')}`);

    await prisma.$transaction(async (tx) => {
      await tx.order.createMany({
        data: orderIds.map((id, i) => ({
          id,
          outlet_id: tenantA.outlet.id,
          order_number: 2000 + i,
          order_type: 'takeaway' as const, // takeaway doesn't require session_id
          status: 'pending_confirmation',
          subtotal: 100,
          tax_amount: 13,
          discount_amount: 0,
          total: 113,
        })),
      });

      await tx.orderItem.createMany({
        data: itemIds.map((itemId, i) => ({
          id: itemId,
          order_id: orderIds[i]!,
          outlet_id: tenantA.outlet.id,
          menu_item_id: menuItemId,
          item_name: 'Test Dish',
          quantity: 1,
          unit_price: 100,
          line_total: 100,
          status: 'placed',
        })),
      });
    });

    // Run all deductions concurrently
    // Start with 10 units, 5 orders each deducting 1 = should end with 5
    const results = await Promise.allSettled(
      orderIds.map((orderId, i) =>
        prisma.$transaction(
          async (tx) => {
            return deductStockForOrder(
              tx,
              orderId,
              tenantA.outlet.id,
              [
                {
                  id: itemIds[i]!,
                  menu_item_id: menuItemId,
                  quantity: 1,
                  item_name: 'Test Dish',
                },
              ],
              testUserId,
            );
          },
          { timeout: 15000 },
        ),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Log errors for debugging
    rejected.forEach((r, i) => {
      console.log(`Rejection ${i}:`, r.reason);
    });

    console.log(`Concurrency test: fulfilled=${fulfilled.length}, rejected=${rejected.length}`);

    // At least 2 should succeed (no lost updates)
    expect(fulfilled.length).toBeGreaterThanOrEqual(2);
    expect(rejected.length).toBeLessThanOrEqual(1);

    // Check final stock - should be 10 - fulfilled_count
    const finalStock = await prisma.outletStock.findUnique({
      where: {
        outlet_id_ingredient_id: {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredientId,
        },
      },
    });

    expect(Number(finalStock?.quantity ?? 0)).toBe(10 - fulfilled.length);

    // Verify stock movements were created for successful orders
    const movements = await prisma.stockMovement.findMany({
      where: { order_id: { in: orderIds } },
    });
    expect(movements.length).toBe(fulfilled.length);
  });

  it('concurrent restock and order deduction should not lose updates', async () => {
    // Create another ingredient for this test
    const ingredient = await prisma.ingredient.create({
      data: {
        organization_id: tenantA.organization.id,
        name: 'Restock Ingredient',
        unit: 'kg',
      },
    });

    // Initial stock: 10 (so deduction won't go negative)
    await prisma.outletStock.create({
      data: {
        outlet_id: tenantA.outlet.id,
        ingredient_id: ingredient.id,
        quantity: 10,
        low_threshold: 0,
      },
    });

    const category = await prisma.menuCategory.create({
      data: {
        organization_id: tenantA.organization.id,
        name: 'Test Category 2',
        sort_order: 2,
      },
    });

    const menuItem = await prisma.menuItem.create({
      data: {
        organization_id: tenantA.organization.id,
        category_id: category.id,
        name: 'Restock Dish',
        base_price: 100,
        is_active: true,
      },
    });

    await prisma.recipeItem.create({
      data: {
        menu_item_id: menuItem.id,
        ingredient_id: ingredient.id,
        quantity: 1,
      },
    });

    const orderId = '33333333-3333-3333-3333-333333333333';
    const itemId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          id: orderId,
          outlet_id: tenantA.outlet.id,
          order_number: 3000,
          order_type: 'takeaway' as const, // takeaway doesn't require session_id
          status: 'pending_confirmation',
          subtotal: 100,
          tax_amount: 13,
          discount_amount: 0,
          total: 113,
        },
      });

      await tx.orderItem.create({
        data: {
          id: itemId,
          order_id: orderId,
          outlet_id: tenantA.outlet.id,
          menu_item_id: menuItem.id,
          item_name: 'Restock Dish',
          quantity: 1,
          unit_price: 100,
          line_total: 100,
          status: 'placed',
        },
      });
    });

    // Run restock and order deduction concurrently
    const restockPromise = prisma.$transaction(
      async (tx) => {
        const currentStock = await tx.outletStock.findUnique({
          where: {
            outlet_id_ingredient_id: {
              outlet_id: tenantA.outlet.id,
              ingredient_id: ingredient.id,
            },
          },
        });

        const quantityBefore = Number(currentStock?.quantity ?? 0);
        const quantityAfter = quantityBefore + 10;

        await tx.outletStock.update({
          where: {
            outlet_id_ingredient_id: {
              outlet_id: tenantA.outlet.id,
              ingredient_id: ingredient.id,
            },
          },
          data: { quantity: { increment: 10 } },
        });

        await tx.stockMovement.create({
          data: {
            outlet_id: tenantA.outlet.id,
            ingredient_id: ingredient.id,
            type: 'restock',
            quantity_delta: 10,
            balance_after: quantityAfter,
            reason: 'Concurrent restock',
            performed_by: testUserId,
          },
        });
      },
      { timeout: 15000 },
    );

    const orderDeductionPromise = prisma.$transaction(
      async (tx) => {
        return deductStockForOrder(
          tx,
          orderId,
          tenantA.outlet.id,
          [
            {
              id: itemId,
              menu_item_id: menuItem.id,
              quantity: 1,
              item_name: 'Restock Dish',
            },
          ],
          testUserId,
        );
      },
      { timeout: 15000 },
    );

    await Promise.all([restockPromise, orderDeductionPromise]);

    // Final stock should be 19 (10 initial + 10 restocked - 1 deducted)
    const finalStock = await prisma.outletStock.findUnique({
      where: {
        outlet_id_ingredient_id: {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredient.id,
        },
      },
    });

    expect(Number(finalStock?.quantity ?? 0)).toBe(19);
  });
});
