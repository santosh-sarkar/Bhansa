import { api } from '@/lib/apiClient'
import type { User, StaffAssignment } from '@/store/authStore'

// Envelope that the backend wraps every success response in
interface SuccessEnvelope<T> {
  success: true
  data: T
}

// Backend response structure from /auth/me (inside the envelope's `data`)
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
  const result = await api.get<SuccessEnvelope<AuthMeResponse>>('/auth/me')
  if (result.error) throw new Error(result.error.message)

  const payload = result.data?.data
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
    assignments: assignments.map((a): StaffAssignment => ({
      id: a.id,
      role: a.role.code,
      outletId: a.outlet?.id ?? null,
      outletName: a.outlet?.name ?? null,
      isActive: a.outlet?.is_active ?? false,
    })),
    permissions: data.permissions,
  }
}