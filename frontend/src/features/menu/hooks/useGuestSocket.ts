'use client'

import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onOrderRejected, onOrderStatusChanged, onItemCancelled, joinSession, leaveSession } from '@/lib/socket'

export function useGuestSocket(sessionId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidateSession = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['guest', 'session'] })
  }, [queryClient])

  useEffect(() => {
    if (!sessionId) return

    // Join the session room
    joinSession(sessionId)

    // Listen for order rejected
    const offRejected = onOrderRejected((data) => {
      console.log('Order rejected:', data)
      invalidateSession()
    })

    // Listen for order status changes
    const offStatusChanged = onOrderStatusChanged((data) => {
      console.log('Order status changed:', data)
      invalidateSession()
    })

    // Listen for item cancelled
    const offItemCancelled = onItemCancelled((data) => {
      console.log('Item cancelled:', data)
      invalidateSession()
    })

    return () => {
      offRejected()
      offStatusChanged()
      offItemCancelled()
      leaveSession(sessionId)
    }
  }, [sessionId, invalidateSession])
}