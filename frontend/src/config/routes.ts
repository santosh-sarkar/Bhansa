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

  // Dashboard routes (protected)
  dashboard: '/dashboard',
  menu: '/dashboard/menu',
  outlet: '/dashboard/outlet',
  tables: '/dashboard/tables',
  staff: '/dashboard/staff',
  orders: '/dashboard/orders',
  kitchen: '/dashboard/kitchen',
  inventory: '/dashboard/inventory',
  billing: '/dashboard/billing',
  analytics: '/dashboard/analytics',
  subscription: '/dashboard/subscription',
  notifications: '/dashboard/notifications',
  settings: '/dashboard/settings',

  // Admin routes
  admin: '/admin',
  adminOrgs: '/admin/organizations',
  adminPlans: '/admin/plans',
  adminLeads: '/admin/leads',
  adminStats: '/admin/stats',
} as const;