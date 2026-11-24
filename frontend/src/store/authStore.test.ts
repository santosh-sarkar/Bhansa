import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from './authStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should set user and authenticate', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      fullName: 'Test User',
      isActive: true,
      emailVerifiedAt: '2024-01-01T00:00:00Z',
      organizationId: 'org-1',
      organizationName: 'Test Org',
      organizationSlug: 'test-org',
      lastOutletId: 'outlet-1',
      assignments: [
        { id: 'assign-1', role: 'owner', outletId: null, outletName: null, isActive: true },
      ],
      permissions: ['staff.manage', 'menu.edit'],
    }

    useAuthStore.getState().setUser(mockUser)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('should logout and clear user', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      fullName: 'Test User',
      isActive: true,
      emailVerifiedAt: '2024-01-01T00:00:00Z',
      organizationId: 'org-1',
      organizationName: 'Test Org',
      organizationSlug: 'test-org',
      lastOutletId: 'outlet-1',
      assignments: [],
      permissions: [],
    }

    useAuthStore.getState().setUser(mockUser)
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('should check permissions correctly', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      fullName: 'Test User',
      isActive: true,
      emailVerifiedAt: '2024-01-01T00:00:00Z',
      organizationId: 'org-1',
      organizationName: 'Test Org',
      organizationSlug: 'test-org',
      lastOutletId: 'outlet-1',
      assignments: [],
      permissions: ['staff.manage', 'menu.edit'],
    }

    useAuthStore.getState().setUser(mockUser)

    expect(useAuthStore.getState().hasPermission('staff.manage')).toBe(true)
    expect(useAuthStore.getState().hasPermission('menu.edit')).toBe(true)
    expect(useAuthStore.getState().hasPermission('billing.manage')).toBe(false)
  })

  it('should check roles correctly', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      fullName: 'Test User',
      isActive: true,
      emailVerifiedAt: '2024-01-01T00:00:00Z',
      organizationId: 'org-1',
      organizationName: 'Test Org',
      organizationSlug: 'test-org',
      lastOutletId: 'outlet-1',
      assignments: [
        { id: 'assign-1', role: 'owner', outletId: null, outletName: null, isActive: true },
        { id: 'assign-2', role: 'manager', outletId: 'outlet-1', outletName: 'Outlet 1', isActive: true },
      ],
      permissions: [],
    }

    useAuthStore.getState().setUser(mockUser)

    expect(useAuthStore.getState().hasRole('owner')).toBe(true)
    expect(useAuthStore.getState().hasRole('manager')).toBe(true)
    expect(useAuthStore.getState().hasRole('waiter')).toBe(false)
  })

  it('should return current outlet id', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      fullName: 'Test User',
      isActive: true,
      emailVerifiedAt: '2024-01-01T00:00:00Z',
      organizationId: 'org-1',
      organizationName: 'Test Org',
      organizationSlug: 'test-org',
      lastOutletId: 'outlet-1',
      assignments: [],
      permissions: [],
    }

    useAuthStore.getState().setUser(mockUser)
    expect(useAuthStore.getState().getCurrentOutletId()).toBe('outlet-1')

    useAuthStore.getState().setUser({ ...mockUser, lastOutletId: null })
    expect(useAuthStore.getState().getCurrentOutletId()).toBeNull()
  })

  it('should return accessible outlet ids', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      fullName: 'Test User',
      isActive: true,
      emailVerifiedAt: '2024-01-01T00:00:00Z',
      organizationId: 'org-1',
      organizationName: 'Test Org',
      organizationSlug: 'test-org',
      lastOutletId: 'outlet-1',
      assignments: [
        { id: 'assign-1', role: 'owner', outletId: null, outletName: null, isActive: true },
        { id: 'assign-2', role: 'manager', outletId: 'outlet-1', outletName: 'Outlet 1', isActive: true },
        { id: 'assign-3', role: 'waiter', outletId: 'outlet-2', outletName: 'Outlet 2', isActive: true },
        { id: 'assign-4', role: 'kitchen', outletId: 'outlet-3', outletName: 'Outlet 3', isActive: false },
      ],
      permissions: [],
    }

    useAuthStore.getState().setUser(mockUser)
    const outlets = useAuthStore.getState().getAccessibleOutletIds()

    expect(outlets).toContain('outlet-1')
    expect(outlets).toContain('outlet-2')
    expect(outlets).not.toContain('outlet-3') // inactive
    expect(outlets).toHaveLength(2)
  })
})