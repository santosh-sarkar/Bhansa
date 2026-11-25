'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Loader2,
  Truck,
  Package,
  RotateCcw,
  CheckCircle,
  RefreshCw,
  ChefHat,
  AlertTriangle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { fetchKitchenBoard, updateOrderItemStatus, toggleMenuItemAvailability, type KitchenOrderItem, type OrderItemStatus } from '@/features/kitchen/services/kitchen.api'
import { useKitchenSocket } from '@/features/kitchen/hooks/useKitchenSocket'

const itemStatusColors: Record<OrderItemStatus, string> = {
  placed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  served: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const itemStatusLabels: Record<OrderItemStatus, string> = {
  placed: 'Placed',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
}

const itemStatusIcons: Record<OrderItemStatus, React.ReactNode> = {
  placed: <Package className="h-3 w-3" />,
  preparing: <RotateCcw className="h-3 w-3 animate-spin" />,
  ready: <CheckCircle className="h-3 w-3" />,
  served: <Truck className="h-3 w-3" />,
  cancelled: <X className="h-3 w-3" />,
}

const orderStatusColors: Record<string, string> = {
  placed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

const orderStatusLabels: Record<string, string> = {
  placed: 'Placed',
  preparing: 'Preparing',
  ready: 'Ready',
}

const columnOrder: OrderItemStatus[] = ['placed', 'preparing', 'ready']

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function KitchenColumn({ status, title, items, onUpdateStatus, isLoading }: {
  status: OrderItemStatus
  title: string
  items: KitchenOrderItem[]
  onUpdateStatus: (itemId: string, newStatus: OrderItemStatus) => void
  isLoading: boolean
}) {
  const nextStatusMap: Record<OrderItemStatus, OrderItemStatus | null> = {
    placed: 'preparing',
    preparing: 'ready',
    ready: 'served',
    served: null,
    cancelled: null,
  }

  const nextStatus = nextStatusMap[status]

  if (isLoading) {
    return (
      <Card className="flex-1 min-w-[300px] max-w-[400px] flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              {title}
            </span>
            <Badge variant="secondary" className={itemStatusColors[status]}>
              0
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-3 h-full">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex-1 min-w-[300px] max-w-[400px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            {title}
          </span>
          <Badge variant="secondary" className={itemStatusColors[status]}>
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No items</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-muted/50 rounded-lg border border-border/50 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground italic truncate">{item.notes}</p>
                    )}
                    {(() => {
                      if (item.options && typeof item.options === 'object' && item.options !== null) {
                        const opts = item.options as Record<string, unknown>
                        if (Object.keys(opts).length > 0) {
                          return (
                            <p className="text-xs text-muted-foreground mt-1">
                              {JSON.stringify(opts)}
                            </p>
                          )
                        }
                      }
                      return null
                    })()}
                  </div>
                  <Badge variant="secondary" className={cn(itemStatusColors[item.status], 'flex-shrink-0')}>
                    {itemStatusIcons[item.status]}
                    {itemStatusLabels[item.status]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-muted-foreground">
                    Qty: {item.quantity}
                  </span>
                  {nextStatus && item.status === status && (
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => onUpdateStatus(item.id, nextStatus)}
                    >
                      {nextStatus === 'preparing' && <RotateCcw className="h-3 w-3" />}
                      {nextStatus === 'ready' && <CheckCircle className="h-3 w-3" />}
                      {nextStatus === 'served' && <Truck className="h-3 w-3" />}
                      <span className="hidden sm:inline">
                        {itemStatusLabels[nextStatus].charAt(0)}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MenuItemAvailabilityToggle({ itemId, name, isActive, onToggle, isLoading }: {
  itemId: string
  name: string
  isActive: boolean
  onToggle: (itemId: string, isActive: boolean) => void
  isLoading: boolean
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
      <div className="flex items-center gap-3">
        <span className="font-medium truncate max-w-[200px]">{name}</span>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <Switch
        checked={isActive}
        onCheckedChange={(checked: boolean) => !isLoading && onToggle(itemId, checked)}
        disabled={isLoading}
        aria-label={`Toggle availability for ${name}`}
      />
    </div>
  )
}

export default function KitchenPage() {
  const queryClient = useQueryClient()
  const { hasPermission, getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  const [showAvailabilityPanel, setShowAvailabilityPanel] = useState(false)
  const [menuItems, setMenuItems] = useState<Array<{ id: string; name: string; isActive: boolean }>>([])
  const [isLoadingMenu, setIsLoadingMenu] = useState(false)
  const hasFetchedMenuRef = useRef(false)

  // Real-time socket connection
  useKitchenSocket(outletId ?? undefined)

  // Fetch kitchen board
  const { data: boardData, isLoading: boardLoading, refetch: refetchBoard } = useQuery({
    queryKey: ['kitchen', 'board', outletId],
    queryFn: fetchKitchenBoard,
    enabled: !!outletId,
    refetchInterval: 30000,
  })

  const orders = boardData?.orders ?? []

  // Group items by status across all orders
  const itemsByStatus = columnOrder.reduce((acc, status) => {
    acc[status] = orders.flatMap(order =>
      order.items
        .filter(item => item.status === status)
        .map(item => ({ ...item, orderId: order.id, orderNumber: order.orderNumber, tableLabel: order.tableLabel }))
    )
    return acc
  }, {} as Record<OrderItemStatus, (KitchenOrderItem & { orderId: string; orderNumber: number; tableLabel: string })[]>)

  // Mutations
  const updateItemStatusMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: OrderItemStatus }) => updateOrderItemStatus(itemId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] })
    },
    onError: (err: Error) => alert(err.message),
  })

  interface KitchenBoardData {
  orders: Array<{
    id: string
    items: Array<{ id: string; isActive?: boolean } & Record<string, unknown>>
  }>
}

const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ itemId, isActive }: { itemId: string; isActive: boolean }) => toggleMenuItemAvailability(itemId, { isActive }),
    onMutate: async ({ itemId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['kitchen', 'board'] })
      const previousItems = queryClient.getQueryData<KitchenBoardData>(['kitchen', 'board'])
      queryClient.setQueryData<KitchenBoardData>(['kitchen', 'board'], (old) => {
        if (!old?.orders) return old
        return {
          ...old,
          orders: old.orders.map((order) => ({
            ...order,
            items: order.items.map((item) =>
              item.id === itemId ? { ...item, isActive } : item
            ),
          })),
        }
      })
      return { previousItems }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] })
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['kitchen', 'board'], context.previousItems)
      }
      alert(err.message)
    },
  })

  const handleUpdateItemStatus = useCallback((itemId: string, status: OrderItemStatus) => {
    updateItemStatusMutation.mutate({ itemId, status })
  }, [updateItemStatusMutation])

  const handleToggleAvailability = useCallback((itemId: string, isActive: boolean) => {
    toggleAvailabilityMutation.mutate({ itemId, isActive })
  }, [toggleAvailabilityMutation])

  interface MenuItemApiResponse {
  id: string
  name: string
  isActive: boolean
  autoUnavailable: boolean
}

interface CategoryApiResponse {
  items: MenuItemApiResponse[]
}

interface EffectiveMenuApiResponse {
  success: boolean
  data?: {
    categories: CategoryApiResponse[]
  }
}

  // Fetch menu items for availability panel
  const fetchMenuItems = useCallback(async () => {
    if (!outletId) return
    setIsLoadingMenu(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/menu/effective`, {
        credentials: 'include',
        headers: { 'X-Outlet-Id': outletId },
      })
      const data: EffectiveMenuApiResponse = await res.json()
      if (data.success && data.data) {
        const items: Array<{ id: string; name: string; isActive: boolean }> = []
        data.data.categories.forEach((cat) => {
          cat.items.forEach((item) => {
            if (item.isActive) {
              items.push({
                id: item.id,
                name: item.name,
                isActive: item.isActive && !item.autoUnavailable,
              })
            }
          })
        })
        setMenuItems(items)
      }
    } catch (err) {
      console.error('Failed to fetch menu items:', err)
    } finally {
      setIsLoadingMenu(false)
    }
  }, [outletId])

  // Fetch menu items when availability panel is shown
  useEffect(() => {
    if (showAvailabilityPanel && !hasFetchedMenuRef.current) {
      hasFetchedMenuRef.current = true
      void fetchMenuItems()
    }
    // Reset ref when panel is hidden
    if (!showAvailabilityPanel) {
      hasFetchedMenuRef.current = false
    }
  }, [showAvailabilityPanel, fetchMenuItems])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6" />
            Kitchen Board
          </h1>
          <p className="text-muted-foreground">Live order preparation status</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetchBoard()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowAvailabilityPanel(!showAvailabilityPanel)}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            {showAvailabilityPanel ? 'Hide' : 'Show'} Availability
          </Button>
        </div>
      </div>

      {/* Availability Panel */}
      {showAvailabilityPanel && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Menu Item Availability
              </span>
              <Button variant="outline" size="sm" onClick={fetchMenuItems} disabled={isLoadingMenu}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMenu ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : menuItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No menu items found</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {menuItems.map((item) => (
                  <MenuItemAvailabilityToggle
                    key={item.id}
                    itemId={item.id}
                    name={item.name}
                    isActive={item.isActive}
                    onToggle={handleToggleAvailability}
                    isLoading={toggleAvailabilityMutation.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Kitchen Board Columns */}
      {boardLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columnOrder.map((status) => (
            <KitchenColumn
              key={status}
              status={status}
              title={itemStatusLabels[status]}
              items={[]}
              onUpdateStatus={() => {}}
              isLoading={true}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columnOrder.map((status) => (
            <KitchenColumn
              key={status}
              status={status}
              title={itemStatusLabels[status]}
              items={itemsByStatus[status] || []}
              onUpdateStatus={handleUpdateItemStatus}
              isLoading={false}
            />
          ))}
        </div>
      )}

      {/* Orders Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Active Orders Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No active orders</h3>
              <p className="text-muted-foreground">Orders will appear here when guests place them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Order #{order.orderNumber}</span>
                          <Badge variant="secondary" className={orderStatusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                            {orderStatusLabels[order.status] || order.status}
                          </Badge>
                        </div>
                        {order.tableLabel && (
                          <span className="text-sm text-muted-foreground">
                            Table: {order.tableLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatTime(order.createdAt)}</span>
                        <span className="font-mono">
                          {order.items.filter(i => i.status !== 'cancelled').length} items
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}