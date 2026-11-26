'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAuthStore } from '@/store/authStore'
import {
  fetchAnalyticsSummary,
  fetchPeakHours,
  fetchRevenueByDay,
  fetchTopItems,
} from '@/features/analytics/services/analytics.api'
import { SummaryStats } from '@/features/analytics/components/summary-stats'
import { ChartPanel } from '@/features/analytics/components/chart-panel'
import { RevenueChart } from '@/features/analytics/components/revenue-chart'
import { RevenueTable } from '@/features/analytics/components/revenue-table'
import { PeakHoursChart } from '@/features/analytics/components/peak-hours-chart'
import { PeakHoursTable } from '@/features/analytics/components/peak-hours-table'
import { TopItemsTable } from '@/features/analytics/components/top-items-table'
import { PaymentsBreakdown } from '@/features/analytics/components/payments-breakdown'
import { cn } from '@/lib/utils'

type RangeKey = 'today' | '7d' | '30d' | '90d'

const rangeDays: Record<RangeKey, number> = {
  today: 0,
  '7d': 6,
  '30d': 29,
  '90d': 89,
}

function getRange(key: RangeKey) {
  const to = new Date()
  const from = new Date(to)
  from.setUTCHours(0, 0, 0, 0)
  from.setUTCDate(from.getUTCDate() - rangeDays[key])
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
}

export default function AnalyticsPage() {
  const queryClient = useQueryClient()
  const { hasPermission, hasRole, getCurrentOutletId, user } = useAuthStore()
  const outletId = getCurrentOutletId()
  const canView = hasPermission('analytics.view')
  const isOrganizationWide = hasRole('owner')

  const [rangeKey, setRangeKey] = useState<RangeKey>('7d')
  const range = getRange(rangeKey)
  const params = { ...range, outletId: outletId ?? undefined }

  const summaryQuery = useQuery({
    queryKey: ['analytics', 'summary', rangeKey, outletId],
    queryFn: () => fetchAnalyticsSummary(params),
    enabled: canView,
  })

  const revenueQuery = useQuery({
    queryKey: ['analytics', 'revenue-by-day', rangeKey, outletId],
    queryFn: () => fetchRevenueByDay(params),
    enabled: canView,
  })

  const topItemsQuery = useQuery({
    queryKey: ['analytics', 'top-items', rangeKey, outletId],
    queryFn: () => fetchTopItems(params, 10),
    enabled: canView,
  })

  const peakHoursQuery = useQuery({
    queryKey: ['analytics', 'peak-hours', rangeKey, outletId],
    queryFn: () => fetchPeakHours(params),
    enabled: canView,
  })

  const isFetching =
    summaryQuery.isFetching ||
    revenueQuery.isFetching ||
    topItemsQuery.isFetching ||
    peakHoursQuery.isFetching

  const queryError =
    summaryQuery.error ?? revenueQuery.error ?? topItemsQuery.error ?? peakHoursQuery.error

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          You do not have permission to view analytics. Ask an owner or manager for access.
        </AlertDescription>
      </Alert>
    )
  }

  const outletName = user?.assignments.find((a) => a.outletId === outletId)?.outletName
  const scope = outletName
    ? ` for ${outletName}`
    : isOrganizationWide
      ? ' across all outlets'
      : ''

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] leading-9 font-semibold">
            <BarChart3 className="size-6" aria-hidden="true" />
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Revenue, orders and menu performance{scope}.
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
            <ToggleGroupItem value="today">Today</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
            <ToggleGroupItem value="90d">90 days</ToggleGroupItem>
          </ToggleGroup>

          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}>
            <RefreshCw
              data-icon="inline-start"
              className={cn(isFetching && 'animate-spin')}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>

      {queryError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{queryError.message}</span>
            <Button variant="outline" size="sm" onClick={refresh}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <SummaryStats summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

          <Separator />

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel
              title="Revenue by day"
              description="Paid bills per day in the selected period."
              isLoading={revenueQuery.isLoading}
              chart={<RevenueChart data={revenueQuery.data ?? []} />}
              table={<RevenueTable data={revenueQuery.data ?? []} />}
            />
            <ChartPanel
              title="Peak hours"
              description="Orders placed by hour of day."
              isLoading={peakHoursQuery.isLoading}
              chart={<PeakHoursChart data={peakHoursQuery.data ?? []} />}
              table={<PeakHoursTable data={peakHoursQuery.data ?? []} />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Top items</CardTitle>
                <CardDescription>Best sellers by quantity in the selected period.</CardDescription>
              </CardHeader>
              <CardContent>
                <TopItemsTable
                  items={topItemsQuery.data ?? []}
                  isLoading={topItemsQuery.isLoading}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
                <CardDescription>Revenue by method and payment status.</CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentsBreakdown
                  summary={summaryQuery.data}
                  isLoading={summaryQuery.isLoading}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
