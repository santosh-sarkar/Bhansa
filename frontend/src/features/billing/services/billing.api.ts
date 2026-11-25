import { api, type ApiResult } from '@/lib/apiClient'

// ===== Shared =====

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  pagination: Pagination
}

interface SuccessEnvelope<T> {
  success: boolean
  data: T
}

interface PaginatedEnvelope<T> {
  success: boolean
  data: T[]
  pagination: Pagination
}

async function unwrap<T>(promise: Promise<ApiResult<SuccessEnvelope<T>>>): Promise<T> {
  const result = await promise
  if (result.error) throw new Error(result.error.message)
  return result.data.data
}

async function unwrapPaginated<T>(promise: Promise<ApiResult<PaginatedEnvelope<T>>>): Promise<Paginated<T>> {
  const result = await promise
  if (result.error) throw new Error(result.error.message)
  return { data: result.data.data, pagination: result.data.pagination }
}

// ===== Bills =====

export type BillStatus = 'open' | 'paid' | 'cancelled'

export interface BillOrderItem {
  id: string
  menu_item_id: string
  item_name: string
  quantity: number
  unit_price: string
  line_total: string
  status: string
  options: unknown
  notes: string | null
}

export interface BillOrder {
  id: string
  order_number: number
  status: string
  subtotal: string
  tax_amount: string
  discount_amount: string
  total: string
  created_at: string
  items: BillOrderItem[]
}

export interface Bill {
  id: string
  outlet_id: string
  outlet_name: string
  session_id: string | null
  table_id: string | null
  table_label: string | null
  invoice_number: string
  subtotal: string
  tax_amount: string
  service_charge: string
  discount_amount: string
  total: string
  status: BillStatus
  paid_at: string | null
  created_at: string
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  created_by: string | null
  orders: BillOrder[]
}

export type BillListItem = Omit<Bill, 'orders'>

export interface BillListParams {
  page?: number
  limit?: number
  status?: BillStatus
  outletId?: string
  dateFrom?: string
  dateTo?: string
}

export interface GenerateBillInput {
  discount_amount?: string
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function fetchBills(params: BillListParams = {}): Promise<Paginated<BillListItem>> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    status: params.status,
    outlet_id: params.outletId,
    date_from: params.dateFrom,
    date_to: params.dateTo,
  })
  return unwrapPaginated(api.get<PaginatedEnvelope<BillListItem>>(`/bills${query}`))
}

export async function fetchBill(id: string): Promise<Bill> {
  return unwrap(api.get<SuccessEnvelope<Bill>>(`/bills/${id}`))
}

export async function generateBill(sessionId: string, data: GenerateBillInput = {}): Promise<Bill> {
  return unwrap(api.post<SuccessEnvelope<Bill>>(`/sessions/${sessionId}/bill`, data))
}

/**
 * Fetches the printable HTML invoice. This endpoint returns `text/html`,
 * so it cannot go through the JSON api client.
 */
export async function fetchBillInvoice(id: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
  const response = await fetch(`${baseUrl}/bills/${id}/invoice`, {
    credentials: 'include',
    headers: { Accept: 'text/html' },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Failed to load invoice')
  }

  return response.text()
}

// ===== Open sessions (used to generate a bill) =====

export type SessionStatus = 'open' | 'bill_requested' | 'closed'

export interface SessionSummary {
  id: string
  outlet_id: string
  outlet_name: string
  table_id: string | null
  table_label: string
  table_seats: number
  table_status: string
  status: SessionStatus
  opened_at: string
  closed_at: string | null
  orders: Array<{
    id: string
    order_number: number
    status: string
    total: string
    created_at: string
  }>
}

export async function fetchOpenSessions(): Promise<SessionSummary[]> {
  const result = await unwrapPaginated(
    api.get<PaginatedEnvelope<SessionSummary>>('/orders/sessions?limit=100')
  )
  return result.data
}

// ===== Payments =====

export type PaymentMethod = 'cash' | 'card' | 'online'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface Payment {
  id: string
  outlet_id: string
  bill_id: string
  invoice_number?: string | null
  method: PaymentMethod
  status: PaymentStatus
  amount: string
  provider_ref: string | null
  idempotency_key: string | null
  transaction_uuid: string | null
  recorded_at: string
  verified_at: string | null
  recorded_by: string | null
}

export interface PaymentListParams {
  page?: number
  limit?: number
  status?: PaymentStatus
  method?: PaymentMethod
  outletId?: string
  billId?: string
  dateFrom?: string
  dateTo?: string
}

export interface RecordCashPaymentInput {
  amount: string
  idempotency_key?: string
}

export async function fetchPayments(params: PaymentListParams = {}): Promise<Paginated<Payment>> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    status: params.status,
    method: params.method,
    outlet_id: params.outletId,
    bill_id: params.billId,
    date_from: params.dateFrom,
    date_to: params.dateTo,
  })
  return unwrapPaginated(api.get<PaginatedEnvelope<Payment>>(`/payments${query}`))
}

export async function fetchPayment(id: string): Promise<Payment> {
  return unwrap(api.get<SuccessEnvelope<Payment>>(`/payments/${id}`))
}

export async function recordCashPayment(billId: string, data: RecordCashPaymentInput): Promise<Payment> {
  return unwrap(api.post<SuccessEnvelope<Payment>>(`/bills/${billId}/payment/cash`, data))
}

// ===== eSewa settings =====

export interface EsewaSettings {
  outlet_id: string
  provider: string
  product_code: string
  secret_key_encrypted: string
  is_test_mode: boolean
  is_enabled: boolean
  updated_at: string
}

export interface EsewaSettingsInput {
  product_code: string
  secret_key: string
  is_test_mode?: boolean
  is_enabled?: boolean
}

export async function fetchEsewaSettings(outletId: string): Promise<EsewaSettings> {
  return unwrap(api.get<SuccessEnvelope<EsewaSettings>>(`/outlets/${outletId}/esewa-settings`))
}

export async function upsertEsewaSettings(outletId: string, data: EsewaSettingsInput): Promise<EsewaSettings> {
  return unwrap(api.put<SuccessEnvelope<EsewaSettings>>(`/outlets/${outletId}/esewa-settings`, data))
}

export async function deleteEsewaSettings(outletId: string): Promise<void> {
  const result = await api.delete<SuccessEnvelope<{ success: boolean }>>(`/outlets/${outletId}/esewa-settings`)
  if (result.error) throw new Error(result.error.message)
}

// ===== eSewa payments =====

export interface EsewaInitiateInput {
  return_url: string
}

export interface EsewaInitiateResult {
  payment_id: string
  transaction_uuid: string
  form_url: string
  form_fields: Record<string, string>
}

export interface EsewaVerifyInput {
  transaction_uuid: string
  status: string
  total_amount: string
  ref_id?: string
  signed_field_names: string
  signature: string
}

export interface EsewaVerifyResponse {
  payment_id: string
  status: 'succeeded' | 'failed'
  amount: string
}

export async function initiateEsewaPayment(
  billId: string,
  data: EsewaInitiateInput
): Promise<EsewaInitiateResult> {
  return unwrap(
    api.post<SuccessEnvelope<EsewaInitiateResult>>(`/bills/${billId}/payment/esewa/initiate`, data)
  )
}

// Called by the eSewa callback (public endpoint, no auth).
export async function verifyEsewaPayment(data: EsewaVerifyInput): Promise<EsewaVerifyResponse> {
  return unwrap(
    api.post<SuccessEnvelope<EsewaVerifyResponse>>('/public/payments/esewa/verify', data)
  )
}
