import { api } from '@/lib/apiClient'
import type { User, StaffAssignment } from '@/store/authStore'

// Backend response structure from /auth/me (auto-unwrapped by apiClient)
export interface AuthMeResponse {
  user: {
    id: string
    email: string
    full_name: string
    phone: string | null
    is_super_admin: boolean
    last_login_at: string | null
    created_at: string
  }
  organization: {
    id: string
    name: string
    slug: string
    status: string
    currency: string
    created_at: string
  } | null
  assignments: Array<{
    id: string
    outlet: {
      id: string
      name: string
      is_active: boolean
      timezone: string
    } | null
    role: {
      id: string
      code: string
      name: string
    }
  }>
  permissions: string[]
  last_outlet: {
    id: string
    name: string
    is_active: boolean
    timezone: string
  } | null
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const result = await api.get<AuthMeResponse>('/auth/me')
  if (result.error) throw new Error(result.error.message)

  const payload = result.data
  if (!payload?.user) throw new Error('Invalid /auth/me response')

  return {
    ...payload,
    assignments: payload.assignments ?? [],
    permissions: payload.permissions ?? [],
  }
}

export function mapAuthMeToUser(data: AuthMeResponse): User {
  const org = data.organization
  const assignments = data.assignments
  const lastOutletId = data.last_outlet?.id ?? assignments[0]?.outlet?.id ?? null

  const mappedAssignments = assignments.map((a): StaffAssignment => ({
    id: a.id,
    role: a.role.code,
    outletId: a.outlet?.id ?? null,
    outletName: a.outlet?.name ?? null,
    // Organization-wide assignments have no outlet, so the outlet's active
    // flag can't be used — treat them as active instead of always inactive.
    isActive: a.outlet ? a.outlet.is_active : true,
  }))

  // Platform admins are flagged on the user record (`is_super_admin`), not via a
  // role assignment. Surface it as an assignment so hasRole('super_admin') and
  // getPrimaryRole() work consistently across the app.
  if (data.user.is_super_admin) {
    mappedAssignments.unshift({
      id: `super-admin-${data.user.id}`,
      role: 'super_admin',
      outletId: null,
      outletName: null,
      isActive: true,
    })
  }

  return {
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.full_name,
    isActive: data.user.is_super_admin || assignments.some((a) => a.outlet?.is_active ?? false),
    emailVerifiedAt: null, // Not returned by backend, would need separate field
    organizationId: org?.id ?? '',
    organizationName: org?.name ?? '',
    organizationSlug: org?.slug ?? '',
    lastOutletId,
    assignments: mappedAssignments,
    permissions: data.permissions,
  }
}