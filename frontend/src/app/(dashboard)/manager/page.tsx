'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Users, Utensils, DollarSign, Package, ClipboardList, ChefHat, AlertTriangle, Grid, Smartphone, Receipt } from 'lucide-react'
import { routes } from '@/config/routes'
import { api } from '@/lib/apiClient'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface ManagerStats {
  outlets: { total: number; active: number }
  staff: { total: number; active: number }
  revenue: { today: number; thisWeek: number; thisMonth: number; lastMonth: number }
  orders: { today: number; thisWeek: number; thisMonth: number; active: number }
  menu: { categories: number; items: number; active: number }
  inventory: { lowStock: number; outOfStock: number }
  tables: { total: number; occupied: number; free: number }
}

async function fetchManagerStats(): Promise<ManagerStats> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<ManagerStats>(`/analytics/summary?outlet_id=${outletId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

interface ActiveOrder {
  id: string
  order_number: number
  table: { label: string } | null
  status: string
  total: number
  created_at: string
}

interface ActiveTable {
  id: string
  label: string
  seats: number | null
  status: string
}

interface LowStockItem {
  id: string
  ingredient: { name: string; unit: string } | null
  quantity: number
  low_threshold: number
}

async function fetchActiveOrders(): Promise<{ data: ActiveOrder[] }> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<{ data: ActiveOrder[] }>(`/orders?status=placed,preparing,ready&limit=10&outlet_id=${outletId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

async function fetchActiveTables(): Promise<{ data: ActiveTable[] }> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<{ data: ActiveTable[] }>(`/tables?outlet_id=${outletId}&status=occupied,needs_bill`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

async function fetchLowStock(): Promise<{ data: LowStockItem[] }> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<{ data: LowStockItem[] }>(`/inventory/low-stock?outlet_id=${outletId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export default function ManagerDashboard() {
  const { getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  const { data: stats } = useQuery({
    queryKey: ['manager', 'stats', outletId],
    queryFn: fetchManagerStats,
    enabled: !!outletId,
  })

  const { data: activeOrders } = useQuery({
    queryKey: ['manager', 'active-orders', outletId],
    queryFn: fetchActiveOrders,
    enabled: !!outletId,
  })

  const { data: activeTables } = useQuery({
    queryKey: ['manager', 'active-tables', outletId],
    queryFn: fetchActiveTables,
    enabled: !!outletId,
  })

  const { data: lowStock } = useQuery({
    queryKey: ['manager', 'low-stock', outletId],
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
      title: 'Active Tables',
      value: `${stats?.tables.occupied ?? 0} / ${stats?.tables.total ?? 0}`,
      subtitle: `${stats?.tables.free ?? 0} free`,
      icon: Grid,
      color: 'text-blue-600 bg-blue-100',
      href: routes.managerTables,
    },
    {
      title: 'Orders Today',
      value: stats?.orders.today ?? 0,
      subtitle: `Active: ${stats?.orders.active ?? 0}`,
      icon: ClipboardList,
      color: 'text-green-600 bg-green-100',
      href: routes.managerOrders,
    },
    {
      title: 'Revenue Today',
      value: formatCurrency(stats?.revenue.today ?? 0),
      subtitle: `This week: ${formatCompactCurrency(stats?.revenue.thisWeek ?? 0)}`,
      icon: DollarSign,
      color: 'text-purple-600 bg-purple-100',
      href: routes.managerAnalytics,
    },
    {
      title: 'Menu Items',
      value: stats?.menu.active ?? 0,
      subtitle: `${stats?.menu.categories ?? 0} categories`,
      icon: Utensils,
      color: 'text-orange-600 bg-orange-100',
      href: routes.managerMenu,
    },
    {
      title: 'Low Stock',
      value: stats?.inventory.lowStock ?? 0,
      subtitle: `${stats?.inventory.outOfStock ?? 0} out`,
      icon: AlertTriangle,
      color: stats?.inventory.lowStock ? 'text-red-600 bg-red-100' : 'text-gray-600 bg-gray-100',
      href: routes.managerInventory,
    },
    {
      title: 'Staff On Duty',
      value: stats?.staff.active ?? 0,
      subtitle: 'Active staff',
      icon: Users,
      color: 'text-pink-600 bg-pink-100',
      href: routes.managerStaff,
    },
  ]

  const ordersList = activeOrders?.data ?? []
  const tablesList = activeTables?.data ?? []
  const lowStockList = lowStock?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outlet Dashboard</h1>
          <p className="text-muted-foreground">Manager overview</p>
        </div>
        <div className="flex gap-2">
          <Link href={routes.managerTables}><Button variant="outline">Tables</Button></Link>
          <Link href={routes.managerOrders}><Button>Orders</Button></Link>
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

      {/* Active Orders & Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Orders</CardTitle>
            <Link href={routes.managerOrders}><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {ordersList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active orders</p>
            ) : (
              <div className="space-y-3">
                {ordersList.map((order: any) => (
                  <Link key={order.id} href={`${routes.managerOrders}/${order.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
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
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Tables */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Occupied Tables</CardTitle>
            <Link href={routes.managerTables}><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {tablesList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">All tables free</p>
            ) : (
              <div className="space-y-3">
                {tablesList.map((table: any) => (
                  <Link key={table.id} href={`${routes.managerTables}/${table.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <Grid className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Table {table.label}</p>
                        <p className="text-xs text-muted-foreground">{table.seats ?? 0} seats • {table.status}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${table.status === 'occupied' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {table.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Low Stock Alerts</CardTitle>
            <Link href={routes.managerInventory}><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {lowStockList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">All stock levels OK</p>
            ) : (
              <div className="space-y-3">
                {lowStockList.map((item: any) => (
                  <Link key={item.id} href={`${routes.managerInventory}/${item.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
                <Link href={routes.managerTables}>
                  <Grid className="h-8 w-8" />
                  <span>Tables</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
                <Link href={routes.managerOrders}>
                  <Smartphone className="h-8 w-8" />
                  <span>Take Order</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
                <Link href={routes.managerKitchen}>
                  <ChefHat className="h-8 w-8" />
                  <span>Kitchen</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
                <Link href={routes.managerBilling}>
                  <Receipt className="h-8 w-8" />
                  <span>Billing</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}