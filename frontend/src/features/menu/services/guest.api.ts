import { api } from '@/lib/apiClient'

export interface GuestMenuResponse {
  table: {
    id: string
    label: string
    seats: number
    qrToken: string
  }
  outlet: {
    id: string
    name: string
    taxPercent: number
    serviceChargePercent: number
  }
  categories: Array<{
    id: string
    name: string
    displayOrder: number
    items: Array<{
      id: string
      name: string
      description: string | null
      price: number
      imageUrl: string | null
      isVegetarian: boolean
      displayOrder: number
      options: Array<{
        id: string
        name: string
        kind: 'variant' | 'addon'
        priceDelta: number
        isActive: boolean
        displayOrder: number
      }>
    }>
  }>
}

export interface GuestSessionResponse {
  id: string
  tableId: string
  tableLabel: string
  outlet: {
    id: string
    name: string
    taxPercent: number
    serviceChargePercent: number
  }
  orders: Array<{
    id: string
    orderNumber: number
    status: string
    subtotal: number
    taxAmount: number
    serviceChargeAmount: number
    totalAmount: number
    items: Array<{
      id: string
      menuItemId: string
      menuItemName: string
      quantity: number
      unitPrice: number
      totalPrice: number
      options: Array<{
        id: string
        name: string
        kind: 'variant' | 'addon'
        priceDelta: number
      }>
    }>
    createdAt: string
  }>
  sessionStatus: string
}

export interface CreateOrderInput {
  items: Array<{
    menuItemId: string
    quantity: number
    options: Array<{ optionId: string; quantity: number }>
  }>
}

export interface OrderResponse {
  id: string
  orderNumber: number
  status: string
  subtotal: number
  taxAmount: number
  serviceChargeAmount: number
  totalAmount: number
  items: Array<{
    id: string
    menuItemId: string
    menuItemName: string
    quantity: number
    unitPrice: number
    totalPrice: number
    options: Array<{
      id: string
      name: string
      kind: 'variant' | 'addon'
      priceDelta: number
    }>
  }>
  createdAt: string
}

export async function fetchGuestMenu(qrToken: string): Promise<GuestMenuResponse> {
  const result = await api.get<GuestMenuResponse>(`/public/tables/${qrToken}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function createGuestSession(qrToken: string): Promise<GuestSessionResponse> {
  const result = await api.post<GuestSessionResponse>('/public/sessions', { qrToken })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchCurrentSession(): Promise<GuestSessionResponse> {
  const result = await api.get<GuestSessionResponse>('/public/sessions/current')
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function placeGuestOrder(data: CreateOrderInput): Promise<OrderResponse> {
  const result = await api.post<OrderResponse>('/public/orders', data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchGuestOrder(orderId: string): Promise<OrderResponse> {
  const result = await api.get<OrderResponse>(`/public/orders/${orderId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function requestBill(): Promise<void> {
  const result = await api.post('/public/sessions/request-bill')
  if (result.error) throw new Error(result.error.message)
}