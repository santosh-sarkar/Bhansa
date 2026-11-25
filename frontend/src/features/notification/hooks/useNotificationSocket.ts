'use client'

import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onNotification } from '@/lib/socket'

export function useNotificationSocket() {
  const queryClient = useQueryClient()

  const invalidateNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
  }, [queryClient])

  useEffect(() => {
    // Use the new socket event helper with automatic cleanup
    const cleanup = onNotification((data) => {
      console.log('New notification:', data)
      invalidateNotifications()
    })

    return cleanup
  }, [invalidateNotifications])
}