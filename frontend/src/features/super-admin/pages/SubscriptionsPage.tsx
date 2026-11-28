'use client'

import { useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/features/super-admin/components/StatusBadge'
import { SubscriptionDetailDialog } from '@/features/super-admin/components/SubscriptionDetailDialog'
import { PageHeader } from '@/features/super-admin/components/PageHeader'
import { useSubscriptionsQuery } from '@/features/super-admin/hooks/useSuperAdminQueries'
import { formatDate } from '@/lib/utils'
import type { SubscriptionListItem } from '@/features/super-admin/services/super-admin.api'

const statusOrder = ['trialing', 'active', 'grace', 'suspended', 'cancelled'] as const

export function SubscriptionsPage() {
  const { data, isLoading, error } = useSubscriptionsQuery()
  const subscriptions = useMemo(() => data?.subscriptions ?? [], [data])

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (statusFilter === 'all') {
      return subscriptions.filter((sub) => !query || sub.organization_name.toLowerCase().includes(query) || sub.plan_name.toLowerCase().includes(query))
    }
    return subscriptions.filter(
      (sub) => sub.status === statusFilter && (!query || sub.organization_name.toLowerCase().includes(query) || sub.plan_name.toLowerCase().includes(query)),
    )
  }, [subscriptions, statusFilter, search])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const sub of subscriptions) {
      counts[sub.status] = (counts[sub.status] ?? 0) + 1
    }
    return counts
  }, [subscriptions])

  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const status of statusOrder) {
      result[status] = statusCounts[status] ?? 0
    }
    return result
  }, [statusCounts])

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description="Manage organization subscriptions." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statusOrder.map((status) => (
          <Card key={status}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground capitalize">{status}</p>
                <span className="font-heading text-2xl font-bold tabular-nums">{counts[status] ?? 0}</span>
              </div>
              <StatusBadge status={status} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input placeholder="Search organization or plan..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? 'all')}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOrder.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertDescription>Failed to load subscriptions.</AlertDescription>
              </Alert>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <h3 className="text-lg font-medium text-foreground mb-2">No subscriptions</h3>
              <p className="text-muted-foreground">No subscriptions match the current filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Grace Ends</TableHead>
                  <TableHead>Overrides</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="font-medium">{sub.organization_name}</div>
                      <div className="text-sm text-muted-foreground">{sub.organization_id}</div>
                    </TableCell>
                    <TableCell>
                      <div>{sub.plan_name}</div>
                      <div className="text-sm text-muted-foreground">{sub.plan_code}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={sub.status} />
                    </TableCell>
                    <TableCell className="text-sm">{sub.trial_ends_at ? formatDate(sub.trial_ends_at) : '—'}</TableCell>
                    <TableCell className="text-sm">{sub.grace_ends_at ? formatDate(sub.grace_ends_at) : '—'}</TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {sub.max_outlets_override && <span>Outlets: {sub.max_outlets_override}</span>}
                        {sub.max_staff_override && <span>Staff: {sub.max_staff_override}</span>}
                        {sub.max_menu_items_override && <span>Menu Items: {sub.max_menu_items_override}</span>}
                        {!sub.max_outlets_override && !sub.max_staff_override && !sub.max_menu_items_override ? <span>—</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(sub.id)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SubscriptionDetailDialog subscriptionId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
