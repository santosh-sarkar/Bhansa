// Side-effect imports to register all OpenAPI paths with the registry
// This file should be imported once at application startup (e.g., in server.ts)

import '@/swagger/paths/auth';
import '@/swagger/paths/health';
import '@/swagger/paths/outlets';
import '@/swagger/paths/staff';
import '@/swagger/paths/menu/category';
import '@/swagger/paths/menu/item';
import '@/swagger/paths/menu/option';
import '@/swagger/paths/menu/recipe';
import '@/swagger/paths/menu/outlet-override';
import '@/swagger/paths/menu/upload';
import '@/swagger/paths/menu/effective-menu';
import '@/swagger/paths/orders';
import '@/swagger/paths/tables';
import '@/swagger/paths/public/table';
import '@/swagger/paths/public/session';
import '@/swagger/paths/public/order';
import '@/swagger/paths/analytics';
import '@/swagger/paths/analytics-consolidated';
import '@/swagger/paths/analytics-inventory-report';
import '@/swagger/paths/billing';
import '@/swagger/paths/inventory/ingredient';
import '@/swagger/paths/inventory/adjustment';
import '@/swagger/paths/inventory/restock';
import '@/swagger/paths/inventory/outlet-stock';
import '@/swagger/paths/inventory/movement-history';
import '@/swagger/paths/notification';
import '@/swagger/paths/plans';
import '@/swagger/paths/plans/subscription-payment';
import '@/swagger/paths/super-admin/subscription';
import '@/swagger/paths/super-admin/stats';
import '@/swagger/paths/super-admin/plan';
import '@/swagger/paths/super-admin/organization';
import '@/swagger/paths/super-admin/lead';
import '@/swagger/paths/payment/esewa-initiate';
import '@/swagger/paths/payment/esewa-settings';
import '@/swagger/paths/payment/payment';

export function registerPaths(): void {
  // This function is called to trigger the side-effect imports above
  // which register all OpenAPI paths with the registry.
}