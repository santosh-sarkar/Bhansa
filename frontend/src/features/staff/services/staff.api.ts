import { api } from '@/lib/apiClient'
import type { StaffAssignment } from '@/store/authStore'

export interface StaffMember {
  id: string
  email: string
  fullName: string
  isActive: boolean
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
  assignments: StaffAssignment[]
}

export interface StaffListResponse {
  data: StaffMember[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface Invitation {
  id: string
  email: string
  role: string
  outletId: string | null
  outletName: string | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: string
  createdAt: string
  invitedBy: {
    id: string
    fullName: string
    email: string
  }
}

export interface InvitationsListResponse {
  data: Invitation[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CreateInvitationInput {
  email: string
  role: 'manager' | 'waiter' | 'kitchen'
  outletId?: string
}

export interface UpdateRoleInput {
  role: 'owner' | 'manager' | 'waiter' | 'kitchen'
}

export interface UpdateAssignmentsInput {
  outletIds: string[]
}

export async function fetchStaff(params?: {
  page?: number
  limit?: number
  status?: string
  role?: string
}): Promise<StaffListResponse> {
  const result = await api.get<StaffListResponse>('/staff', { params })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchInvitations(params?: {
  page?: number
  limit?: number
  status?: string
}): Promise<InvitationsListResponse> {
  const result = await api.get<InvitationsListResponse>('/staff/invitations', { params })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function createInvitation(data: CreateInvitationInput): Promise<Invitation> {
  const result = await api.post<Invitation>('/staff/invitations', data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function revokeInvitation(id: string): Promise<void> {
  const result = await api.delete(`/staff/invitations/${id}`)
  if (result.error) throw new Error(result.error.message)
}

export async function updateStaffRole(id: string, data: UpdateRoleInput): Promise<StaffMember> {
  const result = await api.patch<StaffMember>(`/staff/${id}/role`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateStaffAssignments(id: string, data: UpdateAssignmentsInput): Promise<StaffMember> {
  const result = await api.put<StaffMember>(`/staff/${id}/assignments`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function deactivateStaff(id: string): Promise<void> {
  const result = await api.patch(`/staff/${id}/deactivate`)
  if (result.error) throw new Error(result.error.message)
}