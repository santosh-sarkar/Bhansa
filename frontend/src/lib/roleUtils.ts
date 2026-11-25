'use client'

import type { User } from '@/store/authStore'

export type UserRole = 'super_admin' | 'owner' | 'manager' | 'waiter' | 'kitchen'

export interface RoleConfig {
  label: string
  description: string
  color: string
  icon: string
  dashboardRoute: string
  permissions: string[]
}

/**
 * Role hierarchy (higher = more permissions)
 * Used for permission checks and UI decisions
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 5,
  owner: 4,
  manager: 3,
  waiter: 2,
  kitchen: 1,
}

/**
 * Role configurations for UI
 */
export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Platform administration',
    color: 'text-purple-600 bg-purple-100',
    icon: 'Shield',
    dashboardRoute: '/super-admin',
    permissions: ['*'],
  },
  owner: {
    label: 'Owner',
    description: 'Organization owner',
    color: 'text-blue-600 bg-blue-100',
    icon: 'Building2',
    dashboardRoute: '/owner',
    permissions: ['*'],
  },
  manager: {
    label: 'Manager',
    description: 'Outlet manager',
    color: 'text-green-600 bg-green-100',
    icon: 'Users',
    dashboardRoute: '/manager',
    permissions: ['all_except_billing'],
  },
  waiter: {
    label: 'Waiter',
    description: 'Floor staff',
    color: 'text-orange-600 bg-orange-100',
    icon: 'Utensils',
    dashboardRoute: '/waiter',
    permissions: ['order.create', 'order.update_status', 'order.cancel', 'payment.record'],
  },
  kitchen: {
    label: 'Kitchen',
    description: 'Kitchen staff',
    color: 'text-red-600 bg-red-100',
    icon: 'ChefHat',
    dashboardRoute: '/kitchen',
    permissions: ['order.update_status', 'inventory.*', 'item.mark_unavailable'],
  },
}

/**
 * Get the primary role for a user based on their assignments
 * Priority: super_admin > owner > manager > waiter > kitchen
 */
export function getPrimaryRole(user: User | null): UserRole {
  if (!user) return 'waiter' // fallback
  
  // Check for super admin first
  if (user.assignments.some(a => a.role === 'super_admin' && a.isActive)) {
    return 'super_admin'
  }
  
  // Check for owner (org-wide assignment)
  if (user.assignments.some(a => a.role === 'owner' && a.isActive && !a.outletId)) {
    return 'owner'
  }
  
  // Check for manager
  if (user.assignments.some(a => a.role === 'manager' && a.isActive)) {
    return 'manager'
  }
  
  // Check for waiter
  if (user.assignments.some(a => a.role === 'waiter' && a.isActive)) {
    return 'waiter'
  }
  
  // Check for kitchen
  if (user.assignments.some(a => a.role === 'kitchen' && a.isActive)) {
    return 'kitchen'
  }
  
  // Default fallback
  return 'waiter'
}

/**
 * Get the appropriate dashboard route for a user's primary role
 */
export function getDashboardRoute(role: UserRole): string {
  return ROLE_CONFIGS[role].dashboardRoute
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: User | null, role: UserRole): boolean {
  if (!user) return false
  return user.assignments.some(a => a.role === role && a.isActive)
}

/**
 * Check if user can access a route based on their role
 */
export function canAccessRoute(user: User | null, requiredRole: UserRole): boolean {
  const userRole = getPrimaryRole(user)
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Get all active roles for a user
 */
export function getUserRoles(user: User | null): UserRole[] {
  if (!user) return []
  
  const roles: UserRole[] = []
  const roleSet = new Set<string>()
  
  for (const assignment of user.assignments) {
    if (assignment.isActive && !roleSet.has(assignment.role)) {
      roleSet.add(assignment.role)
      if (assignment.role in ROLE_CONFIGS) {
        roles.push(assignment.role as UserRole)
      }
    }
  }
  
  // Sort by hierarchy (highest first)
  return roles.sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a])
}

/**
 * Get role badge styling
 */
export function getRoleBadgeClass(role: UserRole): string {
  return ROLE_CONFIGS[role].color
}

/**
 * Check if user is a platform admin (super_admin)
 */
export function isSuperAdmin(user: User | null): boolean {
  return hasRole(user, 'super_admin')
}

/**
 * Check if user is an organization owner
 */
export function isOwner(user: User | null): boolean {
  return hasRole(user, 'owner')
}

/**
 * Check if user has outlet-level access (manager, waiter, kitchen)
 */
export function hasOutletAccess(user: User | null): boolean {
  return hasRole(user, 'manager') || hasRole(user, 'waiter') || hasRole(user, 'kitchen')
}