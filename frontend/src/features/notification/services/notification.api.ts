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

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export interface Notification {
  id: string
  outlet_id: string | null
  user_id: string | null
  type: string
  payload: Record<string, string>
  read_at: string | null
  created_at: string
  outlet: { id: string; name: string } | null
  user: { id: string; full_name: string; email: string } | null
}

export interface NotificationsListResponse {
  data: Notification[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UnreadCountResponse {
  count: number
}

export interface CreateNotificationInput {
  outlet_id?: string
  user_id?: string
  type: string
  payload?: Record<string, string>
}

export async function fetchNotifications(params?: {
  page?: number
  limit?: number
  read?: boolean
  type?: string
}): Promise<NotificationsListResponse> {
  return unwrap(
    api.get<SuccessEnvelope<NotificationsListResponse>>(`/notifications${buildQuery(params ?? {})}`)
  )
}

export async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  return unwrap(api.get<SuccessEnvelope<UnreadCountResponse>>('/notifications/unread-count'))
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return unwrap(api.patch<SuccessEnvelope<Notification>>(`/notifications/${id}/read`))
}

export async function markAllNotificationsRead(): Promise<{ count: number }> {
  return unwrap(api.post<SuccessEnvelope<{ count: number }>>('/notifications/read-all'))
}

export async function createNotification(data: CreateNotificationInput): Promise<Notification> {
  return unwrap(api.post<SuccessEnvelope<Notification>>('/notifications', data))
}