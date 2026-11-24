import { api } from '@/lib/apiClient'

export interface Table {
  id: string
  label: string
  seats: number
  qrToken: string
  status: 'free' | 'occupied' | 'needs_bill'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TableListResponse {
  data: Table[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CreateTableInput {
  label: string
  seats: number
}

export interface UpdateTableInput {
  label?: string
  seats?: number
  isActive?: boolean
}

export async function fetchTables(outletId: string, params?: {
  page?: number
  limit?: number
  isActive?: boolean
  search?: string
}): Promise<TableListResponse> {
  const result = await api.get<TableListResponse>(`/outlets/${outletId}/tables`, { params })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchTable(outletId: string, id: string): Promise<Table> {
  const result = await api.get<Table>(`/outlets/${outletId}/tables/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function createTable(outletId: string, data: CreateTableInput): Promise<Table> {
  const result = await api.post<Table>(`/outlets/${outletId}/tables`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateTable(outletId: string, id: string, data: UpdateTableInput): Promise<Table> {
  const result = await api.patch<Table>(`/outlets/${outletId}/tables/${id}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function deactivateTable(outletId: string, id: string): Promise<void> {
  const result = await api.delete(`/outlets/${outletId}/tables/${id}`)
  if (result.error) throw new Error(result.error.message)
}

export async function regenerateQr(outletId: string, id: string): Promise<{ qrToken: string }> {
  const result = await api.post<{ qrToken: string }>(`/outlets/${outletId}/tables/${id}/regenerate-qr`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchQrImage(outletId: string, id: string): Promise<Blob> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/outlets/${outletId}/tables/${id}/qr`, {
    credentials: 'include',
    headers: {
      'X-Outlet-Id': outletId,
    },
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message ?? 'Failed to fetch QR code')
  }
  return response.blob()
}