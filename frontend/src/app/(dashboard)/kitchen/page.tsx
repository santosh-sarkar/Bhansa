'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Clock, AlertTriangle, CheckCircle, Loader2, MoreHorizontal } from 'lucide-react'

import { api } from '@/lib/apiClient'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useSocketConnectionState } from '@/lib/socket'
import { useNow } from '@/hooks/useNow'

interface KitchenStats {
  orders: { pending: number; preparing: number; ready: number; total: number }
  items: { pending: number; preparing: number; ready: number }
  lowStock: number
}

interface KitchenOrder {
  id: string
  order_number: number
  table: { label: string } | null
  status: string
  created_at: string
  items: KitchenOrderItem[]
}

interface KitchenOrderItem {
  id: string
  menu_item_id: string
  item_name: string
  quantity: number
  status: string
  notes: string | null
}

async function fetchKitchenStats(): Promise<KitchenStats> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<KitchenStats>(`/kitchen/stats?outlet_id=${outletId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

async function fetchKitchenOrders(): Promise<KitchenOrder[]> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<{ data: KitchenOrder[] }>(`/kitchen/orders?outlet_id=${outletId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data?.data ?? []
}

const statusColors: Record<string, string> = {
  pending_confirmation: 'bg-gray-800 text-gray-300 border-gray-700',
  placed: 'bg-blue-900/50 text-blue-300 border-blue-800',
  preparing: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  ready: 'bg-green-900/50 text-green-300 border-green-800',
  served: 'bg-purple-900/50 text-purple-300 border-purple-800',
  completed: 'bg-gray-800 text-gray-400 border-gray-700',
  cancelled: 'bg-red-900/50 text-red-300 border-red-800',
}

const statusLabels: Record<string, string> = {
  pending_confirmation: 'Pending',
  placed: 'Placed',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const itemStatusColors: Record<string, string> = {
  placed: 'bg-blue-900/50 text-blue-300',
  preparing: 'bg-yellow-900/50 text-yellow-300',
  ready: 'bg-green-900/50 text-green-300',
  served: 'bg-purple-900/50 text-purple-300',
  cancelled: 'bg-red-900/50 text-red-300',
}

export default function KitchenDashboard() {
  const { getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()
  const connectionState = useSocketConnectionState()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const now = useNow(30_000)

  const { data: stats } = useQuery({
    queryKey: ['kitchen', 'stats', outletId],
    queryFn: fetchKitchenStats,
    enabled: !!outletId,
    refetchInterval: 30000,
  })

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['kitchen', 'orders', outletId],
    queryFn: fetchKitchenOrders,
    enabled: !!outletId,
    refetchInterval: autoRefresh ? 15000 : false,
  })

  if (!outletId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-kds-background">
        <Card className="max-w-md bg-kds-surface border-kds-border">
          <CardHeader>
            <CardTitle className="text-kds-foreground">Select an Outlet</CardTitle>
            <p className="text-kds-muted">Choose an outlet from the header to view kitchen board</p>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/select-outlet"><Button className="w-full">Select Outlet</Button></Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate time since order
  const getTimeAgo = (createdAt: string) => {
    if (!now) return '—'
    const diff = now - new Date(createdAt).getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    if (minutes > 0) return `${minutes}m ago`
    return `${seconds}s ago`
  }

  // Group orders by status
  const orders = ordersData ?? []
  const pendingOrders = orders.filter(o => o.status === 'placed' || o.status === 'pending_confirmation')
  const preparingOrders = orders.filter(o => o.status === 'preparing')
  const readyOrders = orders.filter(o => o.status === 'ready')

  return (
    <div className="space-y-6 bg-kds-background min-h-screen">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-kds-surface border-kds-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-kds-muted">Pending</p>
              <p className="text-3xl font-bold text-blue-400">{stats?.orders.pending ?? 0}</p>
            </div>
            <Clock className="h-12 w-12 text-blue-500/50" />
          </CardContent>
        </Card>
        <Card className="bg-kds-surface border-kds-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-kds-muted">Preparing</p>
              <p className="text-3xl font-bold text-yellow-400">{stats?.orders.preparing ?? 0}</p>
            </div>
            <Loader2 className="h-12 w-12 text-yellow-500/50 animate-spin" />
          </CardContent>
        </Card>
        <Card className="bg-kds-surface border-kds-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-kds-muted">Ready</p>
              <p className="text-3xl font-bold text-green-400">{stats?.orders.ready ?? 0}</p>
            </div>
            <CheckCircle className="h-12 w-12 text-green-500/50" />
          </CardContent>
        </Card>
        <Card className="bg-kds-surface border-kds-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-kds-muted">Low Stock</p>
              <p className="text-3xl font-bold text-red-400">{stats?.lowStock ?? 0}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-red-500/50" />
          </CardContent>
        </Card>
      </div>

      {/* Connection Status & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-kds-foreground">Kitchen Board</h1>
          <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            connectionState === 'connected' ? 'bg-green-900/50 text-green-400' :
            connectionState === 'connecting' || connectionState === 'reconnecting' ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-red-900/50 text-red-400'
          }`}>
            <span className={`h-2 w-2 rounded-full ${connectionState === 'connected' ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            {connectionState === 'connected' ? 'Live' : connectionState === 'connecting' ? 'Connecting...' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-900/50 text-green-400 border-green-800' : ''}
          >
            <Loader2 className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto Refresh' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetchOrders()} disabled={ordersLoading}>
            <Loader2 className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Kitchen Board - Three Columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Orders */}
        <Card className="bg-kds-surface border-kds-border h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-kds-border">
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <Clock className="h-5 w-5" />
              Pending ({pendingOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-12 text-kds-muted">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No pending orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    timeAgo={getTimeAgo(order.created_at)}
                    statusColor={statusColors[order.status] ?? 'bg-gray-800 text-gray-300'}
                    statusLabel={statusLabels[order.status] ?? order.status}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preparing Orders */}
        <Card className="bg-kds-surface border-kds-border h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-kds-border">
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparing ({preparingOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-12 text-kds-muted">
                <Loader2 className="h-12 w-12 mx-auto mb-4 opacity-30 animate-spin" />
                <p>Nothing preparing</p>
              </div>
            ) : (
              <div className="space-y-4">
                {preparingOrders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    timeAgo={getTimeAgo(order.created_at)}
                    statusColor={statusColors[order.status] ?? 'bg-gray-800 text-gray-300'}
                    statusLabel={statusLabels[order.status] ?? order.status}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ready Orders */}
        <Card className="bg-kds-surface border-kds-border h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-kds-border">
            <CardTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle className="h-5 w-5" />
              Ready ({readyOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {readyOrders.length === 0 ? (
              <div className="text-center py-12 text-kds-muted">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nothing ready</p>
              </div>
            ) : (
              <div className="space-y-4">
                {readyOrders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    timeAgo={getTimeAgo(order.created_at)}
                    statusColor={statusColors[order.status] ?? 'bg-gray-800 text-gray-300'}
                    statusLabel={statusLabels[order.status] ?? order.status}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Kitchen Order Card Component
function KitchenOrderCard({ order, timeAgo, statusColor, statusLabel }: {
  order: KitchenOrder
  timeAgo: string
  statusColor: string
  statusLabel: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${statusColor}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-kds-foreground">Order #{order.order_number}</p>
          <p className="text-sm text-kds-muted">Table: {order.table?.label ?? 'Takeaway'} • {timeAgo}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      
      <div className="space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg ${itemStatusColors[item.status] ?? 'bg-gray-800 text-gray-300'}`}>
            <div className="flex items-center gap-3">
              <span className="font-medium">{item.item_name}</span>
              <span className="text-kds-muted">x{item.quantity}</span>
              {item.notes && (
                <span className="text-xs text-kds-muted italic">&quot;{item.notes}&quot;</span>
              )}
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded capitalize">
              {item.status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-3 border-t border-kds-border flex items-center justify-between">
        <span className="text-xs text-kds-muted">Created: {formatDate(order.created_at)}</span>
        <Button variant="ghost" size="sm" className="text-kds-foreground hover:bg-kds-border">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}