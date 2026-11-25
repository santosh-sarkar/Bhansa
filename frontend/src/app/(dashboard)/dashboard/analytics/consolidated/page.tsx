'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, BarChart3, TrendingUp, ShoppingCart, DollarSign, Package } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import { fetchConsolidatedAnalytics } from '@/features/analytics/services/consolidated.api'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

type RangeKey = '7d' | '30d' | '90d'

const rangeDays: Record<RangeKey, number> = {
  '7d': 6,
  '30d': 29,
  '90d': 89,
}

function getRange(key: RangeKey) {
  const to = new Date()
  const from = new Date(to)
  from.setUTCHours(0, 0, 0, 0)
  from.setUTCDate(from.getUTCDate() - rangeDays[key])
  return { date_from: from.toISOString(), date_to: to.toISOString() }
}

function SummaryCard({ title, value, icon: Icon, trend, color = 'text-primary' }: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  trend?: string
  color?: string
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={cn('h-5 w-5', color)} aria-hidden="true" />
        </div>
        <div className="flex items-end gap-2">
          <span className="font-heading text-3xl font-semibold tabular-nums">{value}</span>
          {trend && <span className="text-sm text-green-600">{trend}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

interface TableColumn<T> {
  key: keyof T
  header: string
  render?: (val: T[keyof T], row: T) => React.ReactNode
  className?: string
}

function OutletBreakdownTable<T extends Record<string, unknown>>({
  title,
  data,
  columns,
  isLoading,
  emptyMessage,
}: {
  title: string
  data: T[]
  columns: TableColumn<T>[]
  isLoading: boolean
  emptyMessage: string
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={String(col.key)} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={String(row.outlet_id ?? idx)}>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)} className={col.className}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ConsolidatedAnalyticsPage() {
  const queryClient = useQueryClient()
  const { hasPermission, hasRole } = useAuthStore()
  const isOwner = hasRole('owner')

  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const range = getRange(rangeKey)

  const canView = hasPermission('analytics.view') && isOwner

  const query = useQuery({
    queryKey: ['analytics', 'consolidated', rangeKey],
    queryFn: () => fetchConsolidatedAnalytics(range),
    enabled: canView,
  })

  const isLoading = query.isLoading
  const summary = query.data

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['analytics', 'consolidated'] })
  }

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Consolidated analytics require Owner role and analytics.view permission.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Loading...</span>
                  <Skeleton className="h-5 w-5" />
                </div>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Separator />
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle><Skeleton className="h-4 w-32" /></CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="size-6" aria-hidden="true" />
            Consolidated Analytics
          </h1>
          <p className="text-muted-foreground">
            Organization-wide view across all {summary?.outlets ?? 0} outlets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[rangeKey]}
            onValueChange={(value) => {
              const next = value[0] as RangeKey | undefined
              if (next) setRangeKey(next)
            }}
            variant="outline"
            size="sm"
            aria-label="Date range"
          >
            <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
            <ToggleGroupItem value="90d">90 days</ToggleGroupItem>
          </ToggleGroup>

          <Button variant="outline" size="sm" onClick={refresh} disabled={query.isFetching}>
            <RefreshCw
              data-icon="inline-start"
              className={cn(query.isFetching && 'animate-spin')}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>

      {query.error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{query.error.message}</span>
            <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Outlets"
              value={summary?.outlets.toString() ?? '-'}
              icon={Package}
            />
            <SummaryCard
              title="Total Revenue"
              value={formatCurrency(summary?.revenue.total ?? '0')}
              icon={DollarSign}
              color="text-green-600"
            />
            <SummaryCard
              title="Total Orders"
              value={summary?.orders.total.toLocaleString() ?? '-'}
              icon={ShoppingCart}
              color="text-blue-600"
            />
            <SummaryCard
              title="Items Sold"
              value={summary?.items.total_sold.toLocaleString() ?? '-'}
              icon={TrendingUp}
              color="text-purple-600"
            />
          </div>

          <Separator />

          <div className="grid gap-6 lg:grid-cols-2">
            <OutletBreakdownTable
              title="Revenue by Outlet"
              data={summary?.revenue.by_outlet ?? []}
              columns={[
                { key: 'outlet_name', header: 'Outlet', render: (v) => <span className="font-medium">{v}</span> },
                { key: 'revenue', header: 'Revenue', className: 'text-right', render: (v) => formatCurrency(v) },
                { key: 'orders', header: 'Orders', className: 'text-right', render: (v) => v.toLocaleString() },
              ]}
              isLoading={isLoading}
              emptyMessage="No revenue data for this period."
            />
            <OutletBreakdownTable
              title="Orders by Outlet"
              data={summary?.orders.by_outlet ?? []}
              columns={[
                { key: 'outlet_name', header: 'Outlet', render: (v) => <span className="font-medium">{v}</span> },
                { key: 'total', header: 'Total', className: 'text-right', render: (v) => v.toLocaleString() },
                { key: 'completed', header: 'Completed', className: 'text-right', render: (v) => v.toLocaleString() },
                { key: 'aov', header: 'Avg Order', className: 'text-right', render: (v) => formatCurrency(v) },
              ]}
              isLoading={isLoading}
              emptyMessage="No order data for this period."
            />
          </div>

          <Separator />

          <div className="grid gap-6 lg:grid-cols-2">
            <OutletBreakdownTable
              title="Payments by Outlet"
              data={summary?.payments.by_outlet ?? []}
              columns={[
                { key: 'outlet_name', header: 'Outlet', render: (v) => <span className="font-medium">{v}</span> },
                { key: 'total', header: 'Total', className: 'text-right', render: (v) => formatCurrency(v) },
                { key: 'succeeded', header: 'Succeeded', className: 'text-right', render: (v) => formatCurrency(v) },
              ]}
              isLoading={isLoading}
              emptyMessage="No payment data for this period."
            />
            <OutletBreakdownTable
              title="Inventory & Wastage by Outlet"
              data={summary?.inventory.by_outlet ?? []}
              columns={[
                { key: 'outlet_name', header: 'Outlet', render: (v) => <span className="font-medium">{v}</span> },
                { key: 'low_stock', header: 'Low Stock Items', className: 'text-right', render: (v) => Number(v) > 0 ? <Badge variant="destructive">{v}</Badge> : <Badge variant="secondary">0</Badge> },
                { key: 'wastage_cost', header: 'Wastage Cost', className: 'text-right', render: (v) => formatCurrency(v) },
              ]}
              isLoading={isLoading}
              emptyMessage="No inventory data for this period."
            />
          </div>

          <Separator />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Items (Overall)</CardTitle>
                <CardDescription>Best sellers across all outlets by quantity.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : summary?.items.top_items_overall.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No items sold in this period.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.items.top_items_overall.map((item, idx) => (
                        <TableRow key={item.menu_item_id}>
                          <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.quantity_sold}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(item.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments by Method</CardTitle>
                <CardDescription>Revenue breakdown by payment method.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 rounded-[2px] bg-primary" aria-hidden="true" />
                      <span className="flex-1 text-sm">Cash</span>
                      <span className="text-sm tabular-nums">{formatCurrency(summary?.payments.by_method.cash ?? '0')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 rounded-[2px] bg-green-500" aria-hidden="true" />
                      <span className="flex-1 text-sm">Online</span>
                      <span className="text-sm tabular-nums">{formatCurrency(summary?.payments.by_method.online ?? '0')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 rounded-[2px] bg-blue-500" aria-hidden="true" />
                      <span className="flex-1 text-sm">Card</span>
                      <span className="text-sm tabular-nums">{formatCurrency(summary?.payments.by_method.card ?? '0')}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between">
                        <span className="font-medium">Total</span>
                        <span className="font-medium tabular-nums">{formatCurrency(summary?.payments.total.toString() ?? '0')}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {summary?.payments.succeeded ?? 0} succeeded, {summary?.payments.failed ?? 0} failed, {summary?.payments.pending ?? 0} pending
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Top Items by Outlet</CardTitle>
              <CardDescription>Top 5 items per outlet by quantity sold.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : summary?.items.top_items_by_outlet.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No item data for this period.</p>
              ) : (
                <div className="space-y-6">
                  {summary.items.top_items_by_outlet.map((outlet) => (
                    <div key={outlet.outlet_id} className="space-y-2">
                      <h4 className="font-medium">{outlet.outlet_name}</h4>
                      <Table className="text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Sold</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {outlet.items.map((item, idx) => (
                            <TableRow key={item.menu_item_id}>
                              <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right tabular-nums">{item.quantity_sold}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(item.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Summary</CardTitle>
              <CardDescription>Stock levels and wastage across outlets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Total Ingredients</span>
                  <span className="font-heading text-2xl font-semibold tabular-nums">{summary?.inventory.total_ingredients.toLocaleString() ?? '-'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Outlets with Low Stock</span>
                  <span className="font-heading text-2xl font-semibold tabular-nums text-destructive">{summary?.inventory.low_stock_outlets ?? '-'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Wastage Cost</span>
                  <span className="font-heading text-2xl font-semibold tabular-nums text-orange-600">{formatCurrency(summary?.inventory.wastage_cost ?? '0')}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Wastage Count</span>
                  <span className="font-heading text-2xl font-semibold tabular-nums">{summary?.inventory.wastage_count.toLocaleString() ?? '-'}</span>
                </div>
              </div>

              {summary?.inventory.by_outlet.length > 0 && (
                <OutletBreakdownTable
                  title="Wastage by Outlet"
                  data={summary.inventory.by_outlet}
                  columns={[
                    { key: 'outlet_name', header: 'Outlet', render: (v) => <span className="font-medium">{v}</span> },
                    { key: 'low_stock', header: 'Low Stock Items', className: 'text-right', render: (v) => Number(v) > 0 ? <Badge variant="destructive">{v}</Badge> : <Badge variant="secondary">0</Badge> },
                    { key: 'wastage_cost', header: 'Wastage Cost', className: 'text-right', render: (v) => formatCurrency(v) },
                  ]}
                  isLoading={false}
                  emptyMessage="No inventory data for this period."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}