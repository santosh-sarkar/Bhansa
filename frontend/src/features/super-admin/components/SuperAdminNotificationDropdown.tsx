'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Bell, Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { routes } from '@/config/routes'
import { fetchSuperAdminUnreadCount } from '@/features/super-admin/services/super-admin-notification.api'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

export function SuperAdminNotificationDropdown() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const user = useAuthStore((state) => state.user)

  const { data: unreadCount, refetch: refetchUnreadCount } = useQuery({
    queryKey: ['super-admin', 'notifications', 'unread-count'],
    queryFn: fetchSuperAdminUnreadCount,
    refetchInterval: 30000,
  })

  const markAllMutation = useMutation({
    mutationFn: async () => {
      // Super admin mark all read - can be implemented when backend supports it
      return { count: 0 }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'notifications'] })
    },
  })

  const handleMarkAllRead = async () => {
    await markAllMutation.mutateAsync()
  }

  const count = unreadCount?.count ?? 0

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`${count} unread notifications`}
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-80 max-h-[600px]">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between">
            <DropdownMenuLabel>Platform Notifications</DropdownMenuLabel>
            {count > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markAllMutation.isPending}
                className="text-xs"
              >
                {markAllMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Mark all read
                  </>
                )}
              </Button>
            )}
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="text-sm text-muted-foreground text-center py-4">
          Super admin notifications (new signups, failed payments, trial alerts) will appear here
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => window.location.href = routes.superAdmin + '/notifications'} className="text-center text-primary cursor-pointer">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}