'use client'

import { useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { onNotification } from '@/lib/socket'
import { fetchSuperAdminUnreadCount } from '@/features/super-admin/services/super-admin-notification.api'

export function useSuperAdminNotificationSocket() {
  const queryClient = useQueryClient()

  const invalidateNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'notifications'] })
  }, [queryClient])

  useEffect(() => {
    const cleanup = onNotification((data) => {
      console.log('Super admin notification:', data)
      invalidateNotifications()
    })

    return cleanup
  }, [invalidateNotifications])
}

export function useSuperAdminUnreadCount() {
  return useQuery({
    queryKey: ['super-admin', 'notifications', 'unread-count'],
    queryFn: fetchSuperAdminUnreadCount,
    refetchInterval: 30000,
  })
}

export function useSuperAdminMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // For now, we'll just invalidate - the backend doesn't have a super admin mark all read endpoint yet
      // This can be extended when needed
      return { count: 0 }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'notifications'] })
    },
  })
}