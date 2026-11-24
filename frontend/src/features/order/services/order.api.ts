import { api } from '@/lib/apiClient'

export type OrderStatus = 'pending_confirmation' | 'placed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled'

export interface OrderListItem {
  id: string
  orderNumber: number
  orderType: string
  status: OrderStatus
  tableId: string | null
  tableLabel: string | null
  sessionId: string | null
  subtotal: string
  taxAmount: string
  discountAmount: string
  totalAmount: string
  createdAt: string
  updatedAt: string
}

export interface OrderListResponse {
  data: OrderListItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface OrderItemOption {
  id: string
  name: string
  kind: 'variant' | 'addon'
  priceDelta: number
  quantity: number
}

export interface OrderItem {
  id: string
  menuItemId: string
  menuItemName: string
  quantity: number
  unitPrice: string
  lineTotal: string
  status: OrderStatus
  options: OrderItemOption[]
  notes: string | null
}

export interface OrderDetail {
  id: string
  orderNumber: number
  orderType: string
  status: OrderStatus
  tableId: string | null
  tableLabel: string | null
  sessionId: string | null
  subtotal: string
  taxAmount: string
  discountAmount: string
  totalAmount: string
  notes: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  confirmedBy: string | null
  items: OrderItem[]
}

export interface ListOrdersParams {
  page?: number
  limit?: number
  status?: OrderStatus
  tableId?: string
  dateFrom?: string
  dateTo?: string
  sessionId?: string
}

export interface CreateStaffOrderInput {
  tableId: string
  items: Array<{
    menuItemId: string
    quantity: number
    options?: Array<{ optionId: string; quantity: number }>
    notes?: string
  }>
  notes?: string
}

export interface CreateStaffOrderResponse {
  id: string
  orderNumber: number
  status: OrderStatus
  subtotal: string
  taxAmount: string
  discountAmount: string
  total: string
  createdAt: string
  items: Array<{
    id: string
    menuItemId: string
    name: string
    quantity: number
    unitPrice: string
    lineTotal: string
    status: OrderStatus
    options: unknown
    notes: string | null
  }>
}

export interface ConfirmOrderResponse {
  order: { id: string; status: OrderStatus }
  previousStatus: OrderStatus
}

export interface RejectOrderInput {
  reason: string
}

export interface RejectOrderResponse {
  order: { id: string; status: OrderStatus }
  previousStatus: OrderStatus
}

export interface UpdateOrderStatusInput {
  status: OrderStatus
  reason?: string
}

export interface UpdateOrderStatusResponse {
  order: { id: string; status: OrderStatus }
  previousStatus: OrderStatus
}

export interface CancelOrderInput {
  reason: string
}

export interface CancelOrderResponse {
  order: { id: string; status: OrderStatus }
  previousStatus: OrderStatus
}

export interface UpdateOrderItemStatusInput {
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled'
}

export interface UpdateOrderItemStatusResponse {
  item: {
    id: string
    menuItemId: string
    itemName: string
    quantity: number
    status: OrderStatus
    orderId: string
  }
  previousStatus: OrderStatus
}

export async function fetchOrders(params?: ListOrdersParams): Promise<OrderListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.status) searchParams.set('status', params.status)
  if (params?.tableId) searchParams.set('table_id', params.tableId)
  if (params?.dateFrom) searchParams.set('date_from', params.dateFrom)
  if (params?.dateTo) searchParams.set('date_to', params.dateTo)
  if (params?.sessionId) searchParams.set('session_id', params.sessionId)

  const result = await api.get<OrderListResponse>(`/orders?${searchParams.toString()}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchOrder(orderId: string): Promise<OrderDetail> {
  const result = await api.get<{ order: OrderDetail }>(`/orders/${orderId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!.order
}

export async function createStaffOrder(data: CreateStaffOrderInput): Promise<CreateStaffOrderResponse> {
  const result = await api.post<CreateStaffOrderResponse>('/orders', data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function confirmOrder(orderId: string): Promise<ConfirmOrderResponse> {
  const result = await api.patch<ConfirmOrderResponse>(`/orders/${orderId}/confirm`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function rejectOrder(orderId: string, data: RejectOrderInput): Promise<RejectOrderResponse> {
  const result = await api.patch<RejectOrderResponse>(`/orders/${orderId}/reject`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateOrderStatus(orderId: string, data: UpdateOrderStatusInput): Promise<UpdateOrderStatusResponse> {
  const result = await api.patch<UpdateOrderStatusResponse>(`/orders/${orderId}/status`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function cancelOrder(orderId: string, data: CancelOrderInput): Promise<CancelOrderResponse> {
  const result = await api.patch<CancelOrderResponse>(`/orders/${orderId}/cancel`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateOrderItemStatus(itemId: string, data: UpdateOrderItemStatusInput): Promise<UpdateOrderItemStatusResponse> {
  const result = await api.patch<UpdateOrderItemStatusResponse>(`/orders/items/${itemId}/status`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}