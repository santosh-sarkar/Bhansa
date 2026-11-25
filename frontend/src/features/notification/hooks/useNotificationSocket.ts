'use client'

import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'

export function useNotificationSocket() {
  const queryClient = useQueryClient()

  const invalidateNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
  }, [queryClient])

  useEffect(() => {
    const s = getSocket()

    // No need to join a specific room - notifications are user-specific
    // The server sends notifications to the user's socket

    const handleNotification = (data: { notificationId: string; type: string; payload: Record<string, string> }) => {
      console.log('New notification:', data)
      invalidateNotifications()
    }

    s.on('notification:new', handleNotification)

    return () => {
      s.off('notification:new', handleNotification)
    }
  }, [invalidateNotifications])
}