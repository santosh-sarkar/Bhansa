import type { User } from '@/store/authStore'
import { routes } from '@/config/routes'
import { LayoutDashboard, Shield, Building2, Users, Utensils, ClipboardList, ChefHat, Package, CreditCard, BarChart3, Settings, Grid, Smartphone, Receipt, Truck } from 'lucide-react'
import { type UserRole, hasRole, isSuperAdmin, isOwner } from '@/lib/roleUtils'

export interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: string | null
  role?: UserRole
}

export interface RoleLayoutConfig {
  prefix: string
  guard: (user: User | null) => boolean
  nav: NavItem[]
  brand: {
    label: string
    icon: React.ComponentType<{ className?: string }>
    href: string
  }
  header: {
    showOutletSwitcher: boolean
    showConnectionIndicator: boolean
    theme: 'light' | 'kds'
  }
  userMenu: {
    settingsHref: string
    roleLabel: string
    roleColor: string
    roleIcon: React.ComponentType<{ className?: string }>
  }
}

export const ROLE_LAYOUTS: Record<UserRole, RoleLayoutConfig> = {
  super_admin: {
    prefix: routes.superAdmin,
    guard: isSuperAdmin,
    nav: [
      { name: 'Overview', href: routes.superAdmin, icon: LayoutDashboard, permission: null },
      { name: 'Organizations', href: routes.superAdminOrgs, icon: Building2, permission: null },
      { name: 'Plans', href: routes.superAdminPlans, icon: CreditCard, permission: null },
      { name: 'Subscriptions', href: routes.superAdminSubscriptions, icon: CreditCard, permission: null },
      { name: 'Analytics', href: routes.superAdminStats, icon: BarChart3, permission: null },
      { name: 'Leads', href: routes.superAdminLeads, icon: Users, permission: null },
    ],
    brand: { label: 'Bansa Platform', icon: Shield, href: routes.superAdmin },
    header: { showOutletSwitcher: false, showConnectionIndicator: true, theme: 'light' },
    userMenu: { settingsHref: routes.superAdminSettings, roleLabel: 'Super Admin', roleColor: 'bg-purple-100 text-purple-800', roleIcon: Shield },
  },
  owner: {
    prefix: routes.owner,
    guard: isOwner,
    nav: [
      { name: 'Dashboard', href: routes.owner, icon: LayoutDashboard, permission: null },
      { name: 'Outlets', href: routes.ownerOutlets, icon: Building2, permission: 'outlets.manage' },
      { name: 'Staff', href: routes.ownerStaff, icon: Users, permission: 'staff.manage' },
      { name: 'Menu', href: routes.ownerMenu, icon: Utensils, permission: 'menu.edit' },
      { name: 'Orders', href: routes.ownerOrders, icon: ClipboardList, permission: 'order.manage' },
      { name: 'Kitchen', href: routes.ownerKitchen, icon: ChefHat, permission: 'order.update_status' },
      { name: 'Inventory', href: routes.ownerInventory, icon: Package, permission: 'inventory.manage' },
      { name: 'Billing', href: routes.ownerBilling, icon: CreditCard, permission: 'payment.record' },
      { name: 'Analytics', href: routes.ownerAnalytics, icon: BarChart3, permission: 'analytics.view' },
      { name: 'Consolidated', href: routes.ownerAnalyticsConsolidated, icon: BarChart3, permission: null, role: 'owner' },
      { name: 'Subscription', href: routes.ownerSubscription, icon: CreditCard, permission: 'billing.manage' },
    ],
    brand: { label: 'Bansa', icon: Building2, href: routes.owner },
    header: { showOutletSwitcher: true, showConnectionIndicator: true, theme: 'light' },
    userMenu: { settingsHref: routes.ownerSettings, roleLabel: 'Owner', roleColor: 'bg-blue-100 text-blue-800', roleIcon: Building2 },
  },
  manager: {
    prefix: routes.manager,
    guard: (user) => hasRole(user, 'manager'),
    nav: [
      { name: 'Dashboard', href: routes.manager, icon: LayoutDashboard, permission: null },
      { name: 'Menu', href: routes.managerMenu, icon: Utensils, permission: 'menu.edit' },
      { name: 'Tables', href: routes.managerTables, icon: Building2, permission: 'tables.manage' },
      { name: 'Orders', href: routes.managerOrders, icon: ClipboardList, permission: 'order.manage' },
      { name: 'Kitchen', href: routes.managerKitchen, icon: ChefHat, permission: 'order.update_status' },
      { name: 'Inventory', href: routes.managerInventory, icon: Package, permission: 'inventory.manage' },
      { name: 'Billing', href: routes.managerBilling, icon: CreditCard, permission: 'payment.record' },
      { name: 'Staff', href: routes.managerStaff, icon: Users, permission: 'staff.manage' },
      { name: 'Analytics', href: routes.managerAnalytics, icon: BarChart3, permission: 'analytics.view' },
      { name: 'Settings', href: routes.managerSettings, icon: Settings, permission: null },
    ],
    brand: { label: 'Bansa Manager', icon: Users, href: routes.manager },
    header: { showOutletSwitcher: true, showConnectionIndicator: true, theme: 'light' },
    userMenu: { settingsHref: routes.managerSettings, roleLabel: 'Manager', roleColor: 'bg-green-100 text-green-800', roleIcon: Users },
  },
  waiter: {
    prefix: routes.waiter,
    guard: (user) => hasRole(user, 'waiter'),
    nav: [
      { name: 'Tables', href: routes.waiterTables, icon: Grid, permission: 'tables.manage' },
      { name: 'Orders', href: routes.waiterOrders, icon: Smartphone, permission: 'order.create' },
      { name: 'Billing', href: routes.waiterBilling, icon: Receipt, permission: 'payment.record' },
    ],
    brand: { label: 'Bansa Floor', icon: Utensils, href: routes.waiter },
    header: { showOutletSwitcher: true, showConnectionIndicator: true, theme: 'light' },
    userMenu: { settingsHref: routes.waiterSettings, roleLabel: 'Waiter', roleColor: 'bg-orange-100 text-orange-800', roleIcon: Utensils },
  },
  kitchen: {
    prefix: routes.kitchenBoard,
    guard: (user) => hasRole(user, 'kitchen'),
    nav: [
      { name: 'Kitchen Board', href: routes.kitchenBoard, icon: ChefHat, permission: 'order.update_status' },
      { name: 'Orders', href: routes.kitchenOrders, icon: ClipboardList, permission: 'order.update_status' },
      { name: 'Inventory', href: routes.kitchenInventory, icon: Truck, permission: 'item.mark_unavailable' },
    ],
    brand: { label: 'Bansa Kitchen', icon: ChefHat, href: routes.kitchenBoard },
    header: { showOutletSwitcher: true, showConnectionIndicator: true, theme: 'kds' },
    userMenu: { settingsHref: routes.kitchenSettings, roleLabel: 'Kitchen', roleColor: 'bg-red-900/30 text-red-300', roleIcon: ChefHat },
  },
}

export function getRoleFromPathname(pathname: string): UserRole | null {
  const prefixes: { role: UserRole; prefix: string }[] = [
    { role: 'super_admin', prefix: routes.superAdmin },
    { role: 'owner', prefix: routes.owner },
    { role: 'manager', prefix: routes.manager },
    { role: 'waiter', prefix: routes.waiter },
    { role: 'kitchen', prefix: routes.kitchenBoard },
  ]
  
  for (const { role, prefix } of prefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return role
    }
  }
  return null
}

export function getRoleConfig(role: UserRole): RoleLayoutConfig {
  return ROLE_LAYOUTS[role]
}