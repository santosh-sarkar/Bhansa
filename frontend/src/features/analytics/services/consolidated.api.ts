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

export interface ConsolidatedSummary {
  period: { from: string; to: string }
  outlets: number
  revenue: {
    total: string
    by_outlet: Array<{ outlet_id: string; outlet_name: string; revenue: string; orders: number }>
  }
  orders: {
    total: number
    completed: number
    cancelled: number
    average_order_value: string
    by_outlet: Array<{ outlet_id: string; outlet_name: string; total: number; completed: number; aov: string }>
  }
  items: {
    total_sold: number
    top_items_overall: Array<{ menu_item_id: string; name: string; quantity_sold: number; revenue: string }>
    top_items_by_outlet: Array<{ outlet_id: string; outlet_name: string; items: Array<{ menu_item_id: string; name: string; quantity_sold: number; revenue: string }> }>
  }
  payments: {
    total: number
    succeeded: number
    failed: number
    pending: number
    by_method: { cash: string; online: string; card: string }
    by_outlet: Array<{ outlet_id: string; outlet_name: string; total: string; succeeded: string }>
  }
  inventory: {
    total_ingredients: number
    low_stock_outlets: number
    wastage_cost: string
    wastage_count: number
    by_outlet: Array<{ outlet_id: string; outlet_name: string; low_stock: number; wastage_cost: string }>
  }
}

export async function fetchConsolidatedAnalytics(params: { date_from?: string; date_to?: string } = {}): Promise<ConsolidatedSummary> {
  return unwrap(api.get<SuccessEnvelope<ConsolidatedSummary>>(`/analytics/consolidated${buildQuery(params)}`))
}