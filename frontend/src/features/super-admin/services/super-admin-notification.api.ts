import { api, type ApiResult } from '@/lib/apiClient'

interface SuccessEnvelope<T> {
  success: boolean
  data: T
}

async function unwrap<T>(promise: Promise<ApiResult<SuccessEnvelope<T>>>): Promise<T> {
  const result = await promise
  if (result.error) throw new Error(result.error.message)
  return result.data.data
}

export interface SuperAdminUnreadCountResponse {
  count: number
}

export async function fetchSuperAdminUnreadCount(): Promise<SuperAdminUnreadCountResponse> {
  return unwrap(api.get<SuccessEnvelope<SuperAdminUnreadCountResponse>>('/super-admin/notifications/unread-count'))
}