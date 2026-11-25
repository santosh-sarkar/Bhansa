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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export interface AnalyticsParams {
  dateFrom?: string
  dateTo?: string
  outletId?: string
}

export interface TopItem {
  menu_item_id: string
  name: string
  quantity_sold: number
  revenue: string
}

export interface AnalyticsSummary {
  period: {
    from: string
    to: string
  }
  revenue: {
    total: string
    cash: string
    online: string
    card: string
  }
  orders: {
    total: number
    completed: number
    cancelled: number
    average_order_value: string
  }
  items: {
    total_sold: number
    top_items: TopItem[]
  }
  payments: {
    total: number
    succeeded: number
    failed: number
    pending: number
  }
}

export interface RevenueByDay {
  date: string
  revenue: string
  orders: number
  average_order_value: string
}

export interface PeakHour {
  hour: number
  orders: number
  revenue: string
  average_order_value: string
}

function toQuery(params: AnalyticsParams, limit?: number): string {
  return buildQuery({
    date_from: params.dateFrom,
    date_to: params.dateTo,
    outlet_id: params.outletId,
    limit,
  })
}

export async function fetchAnalyticsSummary(params: AnalyticsParams = {}): Promise<AnalyticsSummary> {
  return unwrap(api.get<SuccessEnvelope<AnalyticsSummary>>(`/analytics/summary${toQuery(params)}`))
}

export async function fetchRevenueByDay(params: AnalyticsParams = {}): Promise<RevenueByDay[]> {
  return unwrap(api.get<SuccessEnvelope<RevenueByDay[]>>(`/analytics/revenue-by-day${toQuery(params)}`))
}

export async function fetchTopItems(params: AnalyticsParams = {}, limit = 10): Promise<TopItem[]> {
  return unwrap(api.get<SuccessEnvelope<TopItem[]>>(`/analytics/top-items${toQuery(params, limit)}`))
}

export async function fetchPeakHours(params: AnalyticsParams = {}): Promise<PeakHour[]> {
  return unwrap(api.get<SuccessEnvelope<PeakHour[]>>(`/analytics/peak-hours${toQuery(params)}`))
}
