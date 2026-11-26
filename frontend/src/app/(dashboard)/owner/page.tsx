'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Building2, Users, Utensils, DollarSign, TrendingUp, Package, ClipboardList, AlertTriangle } from 'lucide-react'
import { routes } from '@/config/routes'
import { api } from '@/lib/apiClient'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface OwnerStats {
  outlets: { total: number; active: number }
  staff: { total: number; active: number }
  revenue: { today: number; thisWeek: number; thisMonth: number; lastMonth: number }
  orders: { today: number; thisWeek: number; thisMonth: number }
  menu: { categories: number; items: number; active: number }
  inventory: { lowStock: number; outOfStock: number }
}

interface RecentOrder {
  id: string
  order_number: number
  table: { label: string } | null
  status: string
  total: number
  created_at: string
}

interface LowStockItem {
  id: string
  ingredient: { name: string; unit: string } | null
  quantity: number
  low_threshold: number
}

async function fetchOwnerStats(): Promise<OwnerStats> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<OwnerStats>(`/analytics/summary${outletId ? `?outlet_id=${outletId}` : ''}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

async function fetchRecentOrders(): Promise<RecentOrder[]> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<{ data: RecentOrder[] }>(`/orders?limit=5&page=1${outletId ? `&outlet_id=${outletId}` : ''}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!.data
}

async function fetchLowStock(): Promise<LowStockItem[]> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<{ data: LowStockItem[] }>(`/inventory/low-stock${outletId ? `?outlet_id=${outletId}` : ''}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!.data
}

export default function OwnerDashboard() {
  const { user, getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()
  const outletName = user?.assignments.find(a => a.outletId === outletId)?.outletName

  const { data: stats } = useQuery({
    queryKey: ['owner', 'stats', outletId],
    queryFn: fetchOwnerStats,
    enabled: !!outletId,
  })

  const { data: recentOrders } = useQuery({
    queryKey: ['owner', 'recent-orders', outletId],
    queryFn: fetchRecentOrders,
    enabled: !!outletId,
  })

  const { data: lowStock } = useQuery({
    queryKey: ['owner', 'low-stock', outletId],
    queryFn: fetchLowStock,
    enabled: !!outletId,
  })

  if (!outletId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Select an Outlet</CardTitle>
            <p className="text-muted-foreground">Choose an outlet from the header to view dashboard</p>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/select-outlet"><Button className="w-full">Select Outlet</Button></Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Today\'s Revenue',
      value: formatCurrency(stats?.revenue.today ?? 0),
      subtitle: `This month: ${formatCompactCurrency(stats?.revenue.thisMonth ?? 0)}`,
      icon: DollarSign,
      color: 'text-green-600 bg-green-100',
      href: routes.ownerAnalytics,
    },
    {
      title: 'Orders Today',
      value: stats?.orders.today ?? 0,
      subtitle: `This week: ${stats?.orders.thisWeek ?? 0}`,
      icon: ClipboardList,
      color: 'text-blue-600 bg-blue-100',
      href: routes.ownerOrders,
    },
    {
      title: 'Active Outlets',
      value: `${stats?.outlets.active ?? 0} / ${stats?.outlets.total ?? 0}`,
      subtitle: 'Click to manage',
      icon: Building2,
      color: 'text-purple-600 bg-purple-100',
      href: routes.ownerOutlets,
    },
    {
      title: 'Staff',
      value: `${stats?.staff.active ?? 0} / ${stats?.staff.total ?? 0}`,
      subtitle: 'Active / Total',
      icon: Users,
      color: 'text-orange-600 bg-orange-100',
      href: routes.ownerStaff,
    },
    {
      title: 'Menu Items',
      value: stats?.menu.active ?? 0,
      subtitle: `${stats?.menu.categories ?? 0} categories`,
      icon: Utensils,
      color: 'text-pink-600 bg-pink-100',
      href: routes.ownerMenu,
    },
    {
      title: 'Low Stock Alerts',
      value: stats?.inventory.lowStock ?? 0,
      subtitle: `${stats?.inventory.outOfStock ?? 0} out of stock`,
      icon: AlertTriangle,
      color: stats?.inventory.lowStock ? 'text-red-600 bg-red-100' : 'text-gray-600 bg-gray-100',
      href: routes.ownerInventory,
    },
  ]

  const recentOrdersList = recentOrders ?? []
  const lowStockList = lowStock ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {outletName ? `${outletName} Dashboard` : 'Owner Dashboard'}
          </h1>
          <p className="text-muted-foreground">Organization overview</p>
        </div>
        <div className="flex gap-2">
          <Link href={routes.ownerOutlets}><Button variant="outline">Manage Outlets</Button></Link>
          <Link href={routes.ownerAnalytics}><Button>View Analytics</Button></Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = stat.href}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color} rounded-lg p-1`} aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders & Low Stock */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Link href={routes.ownerOrders}><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {recentOrdersList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {recentOrdersList.map((order: any) => (
                  <Link key={order.id} href={`${routes.ownerOrders}/${order.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ClipboardList className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Order #{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">Table {order.table?.label ?? 'N/A'} • {formatCurrency(order.total)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      order.status === 'placed' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'ready' ? 'bg-green-100 text-green-800' :
                      order.status === 'served' ? 'bg-purple-100 text-purple-800' :
                      order.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Low Stock Alerts</CardTitle>
            <Link href={routes.ownerInventory}><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {lowStockList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">All stock levels OK</p>
            ) : (
              <div className="space-y-3">
                {lowStockList.map((item: any) => (
                  <Link key={item.id} href={`${routes.ownerInventory}/${item.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${item.quantity <= 0 ? 'bg-red-100' : 'bg-yellow-100'}`}>
                        <Package className={`h-5 w-5 ${item.quantity <= 0 ? 'text-red-600' : 'text-yellow-600'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.ingredient?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.ingredient?.unit ?? 'units'} remaining
                          {item.low_threshold && ` (threshold: ${item.low_threshold})`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.quantity <= 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {item.quantity <= 0 ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href={routes.ownerMenu}>
                <Utensils className="h-8 w-8" />
                <span>Manage Menu</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href={routes.ownerStaff}>
                <Users className="h-8 w-8" />
                <span>Manage Staff</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href={routes.ownerInventory}>
                <Package className="h-8 w-8" />
                <span>Inventory</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href={routes.ownerAnalytics}>
                <TrendingUp className="h-8 w-8" />
                <span>Analytics</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}