'use client'

import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'

export function useKitchenSocket(outletId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidateKitchen = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] })
  }, [queryClient])

  useEffect(() => {
    if (!outletId) return

    const s = getSocket()

    // Join the outlet kitchen room
    s.emit('join:outlet', { outletId, role: 'kitchen' })

    // Event handlers
    const handleOrderConfirmed = (data: { orderId: string; items: Array<{ menuItemId: string; name: string; quantity: number }>; createdAt: string }) => {
      console.log('Order confirmed:', data)
      invalidateKitchen()
    }
    const handleOrderStatusChanged = (data: { orderId: string; status: string; previousStatus: string }) => {
      console.log('Order status changed:', data)
      invalidateKitchen()
    }
    const handleItemCancelled = (data: { orderId: string; itemId: string; itemName: string; quantity: number; reason: string }) => {
      console.log('Item cancelled:', data)
      invalidateKitchen()
    }
    const handleItemAvailabilityChanged = (data: { menuItemId: string; outletId: string; isAvailable: boolean }) => {
      console.log('Item availability changed:', data)
      invalidateKitchen()
    }
    const handleLowStock = (data: { ingredientId: string; name: string; currentStock: number; threshold: number; outletId: string }) => {
      console.log('Low stock:', data)
    }

    s.on('order:confirmed', handleOrderConfirmed)
    s.on('order:status_changed', handleOrderStatusChanged)
    s.on('item:cancelled', handleItemCancelled)
    s.on('item:availability_changed', handleItemAvailabilityChanged)
    s.on('stock:low', handleLowStock)

    return () => {
      s.off('order:confirmed', handleOrderConfirmed)
      s.off('order:status_changed', handleOrderStatusChanged)
      s.off('item:cancelled', handleItemCancelled)
      s.off('item:availability_changed', handleItemAvailabilityChanged)
      s.off('stock:low', handleLowStock)
      s.emit('leave:outlet', { outletId, role: 'kitchen' })
    }
  }, [outletId, invalidateKitchen])
}