import { api } from '@/lib/apiClient'
import type { User, StaffAssignment } from '@/store/authStore'

export interface AuthMeResponse {
  user: {
    id: string
    email: string
    full_name: string
    is_active: boolean
    email_verified_at: string | null
    organization_id: string
    organization: {
      id: string
      name: string
      slug: string
    }
    last_outlet_id: string | null
    assignments: Array<{
      id: string
      role: string
      outlet_id: string | null
      outlet: { id: string; name: string } | null
      is_active: boolean
    }>
    permissions: string[]
  }
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const result = await api.get<AuthMeResponse>('/auth/me')
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export function mapAuthMeToUser(data: AuthMeResponse['user']): User {
  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    isActive: data.is_active,
    emailVerifiedAt: data.email_verified_at,
    organizationId: data.organization_id,
    organizationName: data.organization.name,
    organizationSlug: data.organization.slug,
    lastOutletId: data.last_outlet_id,
    assignments: data.assignments.map((a): StaffAssignment => ({
      id: a.id,
      role: a.role,
      outletId: a.outlet_id,
      outletName: a.outlet?.name ?? null,
      isActive: a.is_active,
    })),
    permissions: data.permissions,
  }
}