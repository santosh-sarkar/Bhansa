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

export interface SubscriptionPlan {
  id: string
  code: string
  name: string
  price_monthly: string
  currency: string
  max_outlets: number
  max_staff: number | null
  max_menu_items: number | null
  multi_outlet_enabled: boolean
  features: Record<string, unknown>
}

export interface SubscriptionUsage {
  outlets: { current: number; limit: number }
  staff: { current: number; limit: number | null }
  menu_items: { current: number; limit: number | null }
}

export interface SubscriptionDetail {
  id: string
  status: 'trialing' | 'active' | 'grace' | 'suspended' | 'cancelled'
  plan: SubscriptionPlan
  trial_ends_at: string | null
  grace_ends_at: string | null
  current_period_end: string | null
  max_outlets_override: number | null
  max_staff_override: number | null
  max_menu_items_override: number | null
  usage: SubscriptionUsage
}

export async function fetchSubscription(): Promise<SubscriptionDetail> {
  const result = await unwrap(api.get<SuccessEnvelope<{ subscription: SubscriptionDetail }>>('/subscription'))
  return result.subscription
}

export interface CustomPlanRequestInput {
  contact_name: string
  contact_email: string
  outlet_count?: number
  message?: string
}

export interface CustomPlanRequestResponse {
  id: string
  contact_name: string
  contact_email: string
  outlet_count: number | null
  message: string | null
  handled: boolean
  created_at: string
}

export async function submitCustomPlanRequest(data: CustomPlanRequestInput): Promise<CustomPlanRequestResponse> {
  return unwrap(api.post<SuccessEnvelope<CustomPlanRequestResponse>>('/subscription/custom-plan-request', data))
}

export interface SubscriptionPaymentInput {
  outlet_id: string
  amount: number
  currency: string
  payment_method: string
  reference: string
  paid_at: string
}

export interface SubscriptionPaymentResponse {
  id: string
  subscription_id: string
  outlet_id: string
  amount: string
  currency: string
  payment_method: string
  reference: string
  paid_at: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export async function submitSubscriptionPayment(data: SubscriptionPaymentInput): Promise<SubscriptionPaymentResponse> {
  return unwrap(api.post<SuccessEnvelope<SubscriptionPaymentResponse>>('/subscription/payments', data))
}

export interface SubscriptionPaymentListResponse {
  id: string
  subscription_id: string
  outlet_id: string
  amount: string
  currency: string
  payment_method: string
  reference: string
  paid_at: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export async function fetchSubscriptionPayments(params?: {
  page?: number
  limit?: number
}): Promise<{ data: SubscriptionPaymentListResponse[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  const query = searchParams.toString()
  return unwrap(api.get<SuccessEnvelope<{ data: SubscriptionPaymentListResponse[]; pagination: Pagination }>>(`/subscription/payments${query ? `?${query}` : ''}`))
}