'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Grid, Smartphone, Receipt, Users, DollarSign, AlertTriangle, Plus, Circle, CheckCircle } from 'lucide-react'
import { routes } from '@/config/routes'
import { api } from '@/lib/apiClient'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface WaiterStats {
  tables: { total: number; free: number; occupied: number; needsBill: number }
  orders: { active: number; today: number }
  revenue: { today: number }
}

async function fetchWaiterStats(): Promise<WaiterStats> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<WaiterStats>(`/analytics/summary?outlet_id=${outletId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

interface Table {
  id: string
  label: string
  seats: number | null
  status: string
}

interface ActiveOrder {
  id: string
  order_number: number
  table: { label: string } | null
  status: string
  total: number
  created_at: string
}

async function fetchTables(): Promise<{ data: Table[] }> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<{ data: Table[] }>(`/tables?outlet_id=${outletId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

async function fetchActiveOrders(): Promise<{ data: ActiveOrder[] }> {
  const outletId = useAuthStore.getState().getCurrentOutletId()
  const result = await api.get<{ data: ActiveOrder[] }>(`/orders?status=placed,preparing,ready&outlet_id=${outletId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

const statusColors: Record<string, string> = {
  free: 'bg-green-100 text-green-800 border-green-200',
  occupied: 'bg-blue-100 text-blue-800 border-blue-200',
  needs_bill: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

const statusIcons: Record<string, React.ReactNode> = {
  free: <Circle className="h-5 w-5 text-green-600" />,
  occupied: <CheckCircle className="h-5 w-5 text-blue-600" />,
  needs_bill: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
}

function TableGrid({ tables, routes, statusColors, statusIcons }: {
  tables: any[]
  routes: any
  statusColors: Record<string, string>
  statusIcons: Record<string, React.ReactNode>
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {tables.map((table: any) => (
        <Link
          key={table.id}
          href={`${routes.waiterOrders}?table=${table.id}`}
          className={`relative group p-4 rounded-xl border-2 transition-all hover:shadow-lg ${
            statusColors[table.status] ?? 'bg-gray-100 text-gray-800 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{table.label}</span>
            {table.seats && (
              <span className="text-xs text-muted-foreground">{table.seats} seats</span>
            )}
          </div>
          <div className="flex items-center justify-center">
            {statusIcons[table.status] ?? <Circle className="h-5 w-5 text-gray-400" />}
          </div>
          
          {/* Table status badge */}
          <div className="absolute bottom-2 left-2 right-2">
            <span className={`text-xs font-medium px-2 py-1 rounded-full w-full text-center ${
              table.status === 'free' ? 'bg-green-100 text-green-800' :
              table.status === 'occupied' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {table.status === 'free' ? 'Available' :
               table.status === 'occupied' ? 'Occupied' : 'Needs Bill'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function WaiterDashboard() {
  const { getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  const { data: stats } = useQuery({
    queryKey: ['waiter', 'stats', outletId],
    queryFn: fetchWaiterStats,
    enabled: !!outletId,
  })

  const { data: tablesData } = useQuery({
    queryKey: ['waiter', 'tables', outletId],
    queryFn: fetchTables,
    enabled: !!outletId,
  })

  const { data: activeOrders } = useQuery({
    queryKey: ['waiter', 'active-orders', outletId],
    queryFn: fetchActiveOrders,
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

  const tables = tablesData?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Floor View</h1>
          <p className="text-muted-foreground">Table management & orders</p>
        </div>
        <div className="flex gap-2">
          <Link href={routes.waiterOrders}><Button>Active Orders</Button></Link>
          <Link href={routes.waiterTables}><Button variant="outline">All Tables</Button></Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Free Tables</p>
              <p className="text-3xl font-bold">{stats?.tables.free ?? 0}</p>
            </div>
            <Grid className="h-12 w-12 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Occupied</p>
              <p className="text-3xl font-bold">{stats?.tables.occupied ?? 0}</p>
            </div>
            <Users className="h-12 w-12 text-blue-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Needs Bill</p>
              <p className="text-3xl font-bold">{stats?.tables.needsBill ?? 0}</p>
            </div>
            <DollarSign className="h-12 w-12 text-yellow-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Orders</p>
              <p className="text-3xl font-bold">{stats?.orders.active ?? 0}</p>
            </div>
            <Smartphone className="h-12 w-12 text-purple-600" />
          </CardContent>
        </Card>
      </div>

      {/* Table Grid - Visual Floor Plan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tables</CardTitle>
          <Link href={routes.waiterTables}><Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Manage Tables
            </Button></Link>
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <div className="text-center py-8">
              <Grid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tables configured</p>
              <Link href={routes.waiterTables}><Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Table
                </Button></Link>
            </div>
          ) : (
            <TableGrid tables={tables} routes={routes} statusColors={statusColors} statusIcons={statusIcons} />
          )}
        </CardContent>
      </Card>

      {/* Active Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Orders</CardTitle>
          <Link href={routes.waiterOrders}><Button variant="ghost" size="sm">View all</Button></Link>
        </CardHeader>
        <CardContent>
          {activeOrders?.data?.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No active orders</p>
          ) : (
            <div className="space-y-3">
              {activeOrders?.data?.map((order: any) => (
                <Link key={order.id} href={`${routes.waiterOrders}/${order.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors border border-muted">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Order #{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">Table {order.table?.label ?? 'N/A'} • {formatCurrency(order.total)}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    order.status === 'placed' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {order.status}
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href={routes.waiterTables}>
                <Grid className="h-8 w-8" />
                <span>Table Map</span>
              </Link>
            </Button>
            <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href={routes.waiterOrders}>
                <Smartphone className="h-8 w-8" />
                <span>Take Order</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href={routes.waiterBilling}>
                <Receipt className="h-8 w-8" />
                <span>Billing</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}