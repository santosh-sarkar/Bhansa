'use client'

import { useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/features/super-admin/components/StatusBadge'
import { LeadDetailDialog } from '@/features/super-admin/components/LeadDetailDialog'
import { Pagination } from '@/features/super-admin/components/Pagination'
import { PageHeader } from '@/features/super-admin/components/PageHeader'
import { useLeadsQuery, useMarkLeadHandledMutation } from '@/features/super-admin/hooks/useSuperAdminQueries'
import { formatDate } from '@/lib/utils'
import type { Lead } from '@/features/super-admin/services/super-admin.api'

type HandledFilter = 'all' | 'true' | 'false'

export function LeadsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [handledFilter, setHandledFilter] = useState<HandledFilter>('all')
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useLeadsQuery({ page, limit, handled: handledFilter === 'all' ? undefined : handledFilter })

  const markHandledMutation = useMarkLeadHandledMutation()

  const leads = data?.leads ?? []
  const pagination = data?.pagination

  const counts = useMemo(() => {
    const all = leads
    return {
      total: all.length,
      handled: all.filter((lead) => lead.handled).length,
      pending: all.filter((lead) => !lead.handled).length,
    }
  }, [leads])

  const filtered = useMemo(() => {
    if (handledFilter === 'true') return leads.filter((lead) => lead.handled)
    if (handledFilter === 'false') return leads.filter((lead) => !lead.handled)
    return leads
  }, [leads, handledFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Plan Leads"
        description="Requests from customers interested in custom plans."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Leads</p>
              <span className="font-heading text-2xl font-bold tabular-nums">{counts.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Handled</p>
              <span className="font-heading text-2xl font-bold tabular-nums text-green-600">{counts.handled}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <span className="font-heading text-2xl font-bold tabular-nums text-yellow-600">{counts.pending}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={handledFilter} onValueChange={(value) => { setHandledFilter((value ?? 'all') as HandledFilter); setPage(1) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Handled</SelectItem>
                <SelectItem value="false">Pending</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
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
                <AlertDescription>Failed to load leads.</AlertDescription>
              </Alert>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <h3 className="text-lg font-medium text-foreground mb-2">No leads found</h3>
              <p className="text-muted-foreground">No leads match the current filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Outlets</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.contact_name}</TableCell>
                    <TableCell>{lead.contact_email}</TableCell>
                    <TableCell className="text-right tabular-nums">{lead.outlet_count ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.organization_name ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={lead.handled ? 'handled' : 'pending'} />
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(lead.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(lead.id)}>
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

      {pagination && pagination.totalPages > 1 ? (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} isLoading={isLoading} onPageChange={setPage} />
      ) : null}

      <LeadDetailDialog leadId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
