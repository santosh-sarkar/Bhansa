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
  const result = await api.post<Outlet>('/outlets', {
    name: data.name,
    address: data.address,
    phone: data.phone,
    timezone: data.timezone,
    tax_percent: data.taxPercent,
    service_charge_percent: data.serviceChargePercent,
  })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export interface SetActiveOutletResponse {
  id: string
  organization_id: string
  name: string
  address: string | null
  phone: string | null
  timezone: string
  tax_percent: string
  service_charge_percent: string
  is_active: boolean
  created_at: string
}

export async function setActiveOutlet(outletId: string): Promise<SetActiveOutletResponse> {
  const result = await api.post<SetActiveOutletResponse>('/outlets/me/active-outlet', { outlet_id: outletId })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}