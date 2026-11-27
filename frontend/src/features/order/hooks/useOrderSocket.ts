'use client'

import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket, joinOutlet, leaveOutlet } from '@/lib/socket'

export function useOrderSocket(outletId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidateOrders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] })
  }, [queryClient])

  useEffect(() => {
    if (!outletId) return

    const s = getSocket()

    // Join the outlet waiters room (server determines role from user's assignments)
    joinOutlet(outletId, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        console.error('[OrderSocket] Failed to join outlet:', response.error)
      }
    })

    // Event handlers
    const handleOrderConfirmed = (data: { orderId: string; items: Array<{ menuItemId: string; name: string; quantity: number }>; createdAt: string }) => {
      console.log('Order confirmed:', data)
      invalidateOrders()
    }
    const handleOrderRejected = (data: { orderId: string; reason: string }) => {
      console.log('Order rejected:', data)
      invalidateOrders()
    }
    const handleOrderStatusChanged = (data: { orderId: string; status: string; previousStatus: string }) => {
      console.log('Order status changed:', data)
      invalidateOrders()
    }
    const handleItemCancelled = (data: { orderId: string; itemId: string; itemName: string; quantity: number; reason: string }) => {
      console.log('Item cancelled:', data)
      invalidateOrders()
    }
    const handleLowStock = (data: { ingredientId: string; name: string; currentStock: number; threshold: number; outletId: string }) => {
      console.log('Low stock:', data)
    }

    s.on('order:confirmed', handleOrderConfirmed)
    s.on('order:rejected', handleOrderRejected)
    s.on('order:status_changed', handleOrderStatusChanged)
    s.on('item:cancelled', handleItemCancelled)
    s.on('stock:low', handleLowStock)

    return () => {
      s.off('order:confirmed', handleOrderConfirmed)
      s.off('order:rejected', handleOrderRejected)
      s.off('order:status_changed', handleOrderStatusChanged)
      s.off('item:cancelled', handleItemCancelled)
      s.off('stock:low', handleLowStock)
      leaveOutlet(outletId)
    }
  }, [outletId, invalidateOrders])
}