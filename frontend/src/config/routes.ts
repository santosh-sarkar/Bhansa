export const routes = {
  // Public routes
  landing: '/',
  pricing: '/pricing',
  guestMenu: (qrToken: string) => `/m/${qrToken}`,

  // Auth routes
  login: '/login',
  register: '/register',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvite: '/accept-invite',

  // Payment callback routes (public)
  esewaSuccess: '/payment/esewa/success',
  esewaFailure: '/payment/esewa/failure',

  // Outlet selection (shared, no role prefix)
  selectOutlet: '/select-outlet',

  // Legacy redirect (for login and backwards compatibility)
  dashboard: '/dashboard',

  // Role-based dashboard routes
  superAdmin: '/super-admin',
  owner: '/owner',
  manager: '/manager',
  waiter: '/waiter',
  kitchenBoard: '/kitchen',

  // Super Admin routes
  superAdminOrgs: '/super-admin/organizations',
  superAdminPlans: '/super-admin/plans',
  superAdminSubscriptions: '/super-admin/subscriptions',
  superAdminStats: '/super-admin/stats',
  superAdminLeads: '/super-admin/leads',
  superAdminSettings: '/super-admin/settings',

  // Owner routes
  ownerOutlets: '/owner/outlets',
  ownerStaff: '/owner/staff',
  ownerMenu: '/owner/menu',
  ownerOrders: '/owner/orders',
  ownerKitchen: '/owner/kitchen',
  ownerInventory: '/owner/inventory',
  ownerBilling: '/owner/billing',
  ownerAnalytics: '/owner/analytics',
  ownerAnalyticsConsolidated: '/owner/analytics/consolidated',
  ownerSubscription: '/owner/subscription',
  ownerSettings: '/owner/settings',
  ownerNotifications: '/owner/notifications',

  // Manager routes
  managerMenu: '/manager/menu',
  managerTables: '/manager/tables',
  managerOrders: '/manager/orders',
  managerKitchen: '/manager/kitchen',
  managerInventory: '/manager/inventory',
  managerBilling: '/manager/billing',
  managerStaff: '/manager/staff',
  managerAnalytics: '/manager/analytics',
  managerSettings: '/manager/settings',
  managerNotifications: '/manager/notifications',

  // Waiter routes
  waiterTables: '/waiter/tables',
  waiterOrders: '/waiter/orders',
  waiterBilling: '/waiter/billing',
  waiterNotifications: '/waiter/notifications',
  waiterSettings: '/waiter/settings',

  // Kitchen routes
  kitchenOrders: '/kitchen/orders',
  kitchenInventory: '/kitchen/inventory',
  kitchenNotifications: '/kitchen/notifications',
  kitchenSettings: '/kitchen/settings',

  // Admin routes
  admin: '/admin',
  adminOrgs: '/admin/organizations',
  adminPlans: '/admin/plans',
  adminLeads: '/admin/leads',
  adminStats: '/admin/stats',
} as const;