'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/features/super-admin/components/StatCard'
import { TrendChart } from '@/features/super-admin/components/TrendChart'
import { PageHeader } from '@/features/super-admin/components/PageHeader'
import { StatusBadge } from '@/features/super-admin/components/StatusBadge'
import { usePlatformStatsQuery } from '@/features/super-admin/hooks/useSuperAdminQueries'
import { TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function AnalyticsPage() {
  const { data, isLoading, error, refetch } = usePlatformStatsQuery()

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Platform-wide analytics." />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Platform-wide analytics." />
        <Alert variant="destructive">
          <AlertDescription>Failed to load analytics.</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const { revenue, subscriptions, plans, staff, leads } = data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Platform-wide analytics."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Organizations" value={data.organizations.total} icon={TrendingUp} color="text-blue-600" subtitle={`${data.organizations.active} active`} />
        <StatCard title="Revenue (This Month)" value={formatCurrency(revenue.this_month)} icon={TrendingUp} color="text-green-600" subtitle={`All-time ${formatCurrency(revenue.total_paid)}`} />
        <StatCard title="Subscriptions" value={subscriptions.active} icon={TrendingUp} color="text-purple-600" subtitle={`${subscriptions.trialing} trialing`} />
        <StatCard title="Staff" value={staff.active} icon={TrendingUp} color="text-orange-600" subtitle={`${staff.by_role.length} roles`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
          <CardDescription>Monthly revenue trend</CardDescription>
        </CardHeader>
        <CardContent>
          {data.monthly_revenue.length > 0 ? (
            <TrendChart data={data.monthly_revenue} />
          ) : (
            <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No revenue data available.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {(['trialing', 'active', 'grace', 'suspended', 'cancelled'] as const).map((status) => (
                <div key={status} className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm font-medium capitalize">{status}</span>
                  <span className="font-heading text-xl font-bold tabular-nums">{subscriptions[status]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff by Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {staff.by_role.map((role) => (
              <div key={role.role} className="flex items-center justify-between rounded-md border p-3">
                <StatusBadge status={role.role} />
                <span className="font-medium tabular-nums">{role.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>Subscription distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Total plans</span>
              <span className="font-medium tabular-nums">{plans.total}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Public plans</span>
              <span className="font-medium tabular-nums">{plans.public}</span>
            </div>
            <div className="space-y-2 pt-2">
              {plans.subscription_distribution.map((dist) => (
                <div key={dist.plan_id} className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">{dist.plan_name} ({dist.plan_code})</span>
                  <span className="font-medium tabular-nums">{dist.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <CardDescription>Lead pipeline</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Total</p>
              <span className="font-heading text-2xl font-bold tabular-nums">{leads.total}</span>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Handled</p>
              <span className="font-heading text-2xl font-bold tabular-nums text-green-600">{leads.handled}</span>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Pending</p>
              <span className="font-heading text-2xl font-bold tabular-nums text-yellow-600">{leads.unhandled}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


