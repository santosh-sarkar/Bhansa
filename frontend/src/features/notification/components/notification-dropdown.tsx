'use client'

import { useState, useEffect } from 'react'
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
import { Bell, Loader2, Check, X, Mail, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { routes } from '@/config/routes'
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead, type Notification } from '@/features/notification/services/notification.api'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { getPrimaryRole } from '@/lib/roleUtils'

const notificationIcons: Record<string, React.ReactNode> = {
  order: <Mail className="h-4 w-4" />,
  payment: <Info className="h-4 w-4" />,
  stock: <AlertTriangle className="h-4 w-4" />,
  system: <Info className="h-4 w-4" />,
  default: <Bell className="h-4 w-4" />,
}

function getNotificationIcon(type: string) {
  return notificationIcons[type] ?? notificationIcons.default
}

function formatNotificationTitle(notification: Notification): string {
  const type = notification.type
  const payload = notification.payload

  switch (type) {
    case 'order':
      return `Order ${payload.action ?? 'update'}`
    case 'payment':
      return `Payment ${payload.status ?? 'received'}`
    case 'stock':
      return `Low stock: ${payload.ingredient ?? 'item'}`
    case 'system':
      return payload.title ?? 'System notification'
    default:
      return payload.title ?? 'Notification'
  }
}

function formatNotificationDescription(notification: Notification): string {
  const payload = notification.payload
  if (payload.message) return payload.message
  if (payload.details) return payload.details
  return 'No additional details'
}

export function NotificationDropdown() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [markAllLoading, setMarkAllLoading] = useState(false)
  const user = useAuthStore((state) => state.user)
  const primaryRole = getPrimaryRole(user)
  const notificationsRoute = primaryRole === 'super_admin' ? routes.superAdmin + '/notifications' :
    primaryRole === 'owner' ? routes.ownerNotifications :
    primaryRole === 'manager' ? routes.managerNotifications :
    primaryRole === 'waiter' ? routes.waiterNotifications :
    routes.kitchenNotifications

  const { data: unreadCount, refetch: refetchUnreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000,
  })

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', 'list', { page: 1, limit: 10 }],
    queryFn: () => fetchNotifications({ page: 1, limit: 10 }),
    enabled: isOpen,
  })

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => {
      setMarkAllLoading(false)
    },
  })

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate(id)
  }

  const handleMarkAllRead = async () => {
    setMarkAllLoading(true)
    await markAllMutation.mutateAsync()
    setMarkAllLoading(false)
  }

  const notifications = notificationsData?.data ?? []

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
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllLoading}
              className="text-xs"
            >
              {markAllLoading ? (
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

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <DropdownMenuItem className="text-sm text-muted-foreground text-center py-4">
            No notifications
          </DropdownMenuItem>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  'flex flex-col items-start gap-1 p-3',
                  !notification.read_at && 'bg-accent/50'
                )}
                onSelect={() => handleMarkRead(notification.id)}
                disabled={markReadMutation.isPending}
              >
                <div className="flex items-start gap-2 w-full">
                  <div className={cn('flex-shrink-0 mt-0.5', !notification.read_at && 'text-primary')}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', !notification.read_at && 'font-semibold')}>
                      {formatNotificationTitle(notification)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatNotificationDescription(notification)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDate(notification.created_at)}
                    </p>
                  </div>
                  {!notification.read_at && (
                    <div className="flex-shrink-0">
                      <span className="size-2 rounded-full bg-primary" />
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => window.location.href = notificationsRoute} className="text-center text-primary cursor-pointer">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}