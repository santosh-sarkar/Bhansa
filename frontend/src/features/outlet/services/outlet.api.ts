import { api } from '@/lib/apiClient'

export interface Outlet {
  id: string
  name: string
  address: string
  phone: string
  timezone: string
  taxPercent: number
  serviceChargePercent: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface OutletListResponse {
  data: Outlet[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UpdateOutletInput {
  name?: string
  address?: string
  phone?: string
  timezone?: string
  taxPercent?: number
  serviceChargePercent?: number
  isActive?: boolean
}

export async function fetchOutlets(params?: {
  page?: number
  limit?: number
  isActive?: boolean
  search?: string
}): Promise<OutletListResponse> {
  const result = await api.get<OutletListResponse>('/outlets', { params })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchOutlet(id: string): Promise<Outlet> {
  const result = await api.get<Outlet>(`/outlets/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateOutlet(id: string, data: UpdateOutletInput): Promise<Outlet> {
  const result = await api.patch<Outlet>(`/outlets/${id}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function deactivateOutlet(id: string): Promise<void> {
  const result = await api.patch(`/outlets/${id}/deactivate`)
  if (result.error) throw new Error(result.error.message)
}

export async function createOutlet(data: Omit<UpdateOutletInput, 'isActive'> & { name: string; address: string }): Promise<Outlet> {
  const result = await api.post<Outlet>('/outlets', data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}