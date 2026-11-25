import { api } from '@/lib/apiClient'

export type OrderItemStatus = 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled'

export interface KitchenOrderItem {
  id: string
  name: string
  quantity: number
  status: OrderItemStatus
  options: unknown
  notes: string | null
}

export interface KitchenOrder {
  id: string
  orderNumber: number
  status: string
  tableLabel: string
  tableId: string | null
  createdAt: string
  items: KitchenOrderItem[]
}

export interface KitchenBoardResponse {
  orders: KitchenOrder[]
}

export interface UpdateItemStatusInput {
  status: OrderItemStatus
}

export interface UpdateItemStatusResponse {
  item: {
    id: string
    menuItemId: string
    itemName: string
    quantity: number
    status: OrderItemStatus
    orderId: string
  }
  previousStatus: OrderItemStatus
}

export interface ToggleItemAvailabilityInput {
  isActive: boolean
}

export interface ToggleItemAvailabilityResponse {
  item: {
    id: string
    isActive: boolean
  }
}

export async function fetchKitchenBoard(): Promise<KitchenBoardResponse> {
  const result = await api.get<KitchenBoardResponse>('/kitchen/orders')
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateOrderItemStatus(itemId: string, data: UpdateItemStatusInput): Promise<UpdateItemStatusResponse> {
  const result = await api.patch<UpdateItemStatusResponse>(`/orders/items/${itemId}/status`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function toggleMenuItemAvailability(itemId: string, data: ToggleItemAvailabilityInput): Promise<ToggleItemAvailabilityResponse> {
  const result = await api.patch<ToggleItemAvailabilityResponse>(`/menu/items/${itemId}`, { is_active: data.isActive })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}