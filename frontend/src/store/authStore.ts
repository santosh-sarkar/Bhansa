import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  fullName: string
  isActive: boolean
  emailVerifiedAt: string | null
  organizationId: string
  organizationName: string
  organizationSlug: string
  lastOutletId: string | null
  assignments: StaffAssignment[]
  permissions: string[]
}

export interface StaffAssignment {
  id: string
  role: string
  outletId: string | null
  outletName: string | null
  isActive: boolean
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  getCurrentOutletId: () => string | null
  getAccessibleOutletIds: () => string[]
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      hasPermission: (permission) => {
        const { user } = get()
        if (!user) return false
        return user.permissions.includes(permission)
      },

      hasRole: (role) => {
        const { user } = get()
        if (!user) return false
        return user.assignments.some((a) => a.role === role && a.isActive)
      },

      getCurrentOutletId: () => {
        const { user } = get()
        return user?.lastOutletId ?? null
      },

      getAccessibleOutletIds: () => {
        const { user } = get()
        if (!user) return []
        return user.assignments
          .filter((a) => a.isActive && a.outletId)
          .map((a) => a.outletId!)
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)