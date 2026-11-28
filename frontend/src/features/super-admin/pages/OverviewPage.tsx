'use client'

import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, CreditCard, Users, Wallet, Store, UserCheck, Mail, Clock, CheckCircle } from 'lucide-react'
import { StatCard } from '@/features/super-admin/components/StatCard'
import { TrendChart } from '@/features/super-admin/components/TrendChart'
import { StatusBadge } from '@/features/super-admin/components/StatusBadge'
import { PageHeader } from '@/features/super-admin/components/PageHeader'
import { useLeadsQuery, usePlatformStatsQuery } from '@/features/super-admin/hooks/useSuperAdminQueries'
import { useSubscriptionsQuery } from '@/features/super-admin/hooks/useSuperAdminQueries'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PlatformStats } from '@/features/super-admin/services/super-admin.api'

export function OverviewPage() {
  const router = useRouter()
  const { data: stats, isLoading, error, refetch } = usePlatformStatsQuery()
  const { data: subscriptions } = useSubscriptionsQuery()
  const { data: leads } = useLeadsQuery()

  const loading = isLoading

  const needsAttention = (subscriptions?.subscriptions ?? []).filter(
    (sub) => sub.status === 'grace' || sub.status === 'suspended',
  )
  const pendingLeads = (leads?.leads ?? []).filter((lead) => !lead.handled)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Overview"
        description="Platform-wide management: organizations, plans, subscriptions, leads, and analytics."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            Refresh
          </Button>
        }
      />

      {loading || !stats ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Monthly recurring revenue trend</CardDescription>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Subscription Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>Failed to load platform stats.</AlertDescription>
        </Alert>
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Organizations" value={stats.organizations.total} icon={Building2} color="text-blue-600" subtitle={`${stats.organizations.active} active`} />
            <StatCard title="Revenue (This Month)" value={formatCurrency(stats.revenue.this_month)} icon={Wallet} color="text-green-600" subtitle={`All-time ${formatCurrency(stats.revenue.total_paid)}`} />
            <StatCard title="Subscriptions" value={stats.subscriptions.active} icon={CreditCard} color="text-purple-600" subtitle={`${stats.subscriptions.trialing} trialing`} />
            <StatCard title="Active Staff" value={stats.staff.active} icon={UserCheck} color="text-orange-600" subtitle={`${stats.staff.by_role.length} roles`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Total paid, this month, and pending</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Total Paid</span>
                    <span className="font-heading text-2xl font-bold tabular-nums">{formatCurrency(stats.revenue.total_paid)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">This Month</span>
                    <span className="font-heading text-2xl font-bold tabular-nums">{formatCurrency(stats.revenue.this_month)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className="font-heading text-2xl font-bold tabular-nums text-yellow-600">{formatCurrency(stats.revenue.pending)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Monthly Revenue</h4>
                  {stats.monthly_revenue.length > 0 ? (
                    <TrendChart data={stats.monthly_revenue} />
                  ) : (
                    <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No monthly revenue data available.</p>
                  )}
                </div>

                {stats.revenue.by_plan.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium">Revenue by Plan</h4>
                    <div className="space-y-2">
                      {stats.revenue.by_plan.map((plan) => (
                        <div key={plan.plan_code} className="flex items-center justify-between py-2 border-b last:border-0">
                          <span className="text-sm">{plan.plan_name} ({plan.plan_code})</span>
                          <span className="font-medium tabular-nums">{formatCurrency(plan.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Status</CardTitle>
                <CardDescription>Distribution by status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(['trialing', 'active', 'grace', 'suspended', 'cancelled'] as const).map((status) => (
                    <div key={status} className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm font-medium capitalize">{status}</span>
                      <span className="font-heading text-xl font-bold tabular-nums">{stats.subscriptions[status]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Needs Attention</CardTitle>
                <CardDescription>Subscriptions in grace period or suspended, plus pending leads</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {needsAttention.length === 0 && pendingLeads.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                    All clear — no active issues right now.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {needsAttention.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-medium">Subscriptions</h4>
                        {needsAttention.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
                            onClick={() => router.push(`/super-admin/subscriptions?focus=${sub.id}`)}
                          >
                            <div>
                              <p className="font-medium">{sub.organization_name}</p>
                              <p className="text-sm text-muted-foreground">{sub.plan_name}</p>
                            </div>
                            <StatusBadge status={sub.status} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {pendingLeads.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-medium">Pending Leads</h4>
                        {pendingLeads.slice(0, 5).map((lead) => (
                          <button
                            key={lead.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
                            onClick={() => router.push(`/super-admin/leads?focus=${lead.id}`)}
                          >
                            <div>
                              <p className="font-medium">{lead.contact_name}</p>
                              <p className="text-sm text-muted-foreground">{lead.contact_email}</p>
                            </div>
                            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Organizations</CardTitle>
                <CardDescription>Latest 5 organizations created</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => router.push('/super-admin/organizations')}>
                  View all organizations
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
