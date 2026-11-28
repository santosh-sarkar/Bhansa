'use client'

import { useMemo, useState } from 'react'
import { Building2, MoreHorizontal, RefreshCw, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/features/super-admin/components/PageHeader'
import { Pagination } from '@/features/super-admin/components/Pagination'
import { StatusBadge } from '@/features/super-admin/components/StatusBadge'
import { ConfirmDialog } from '@/features/super-admin/components/ConfirmDialog'
import { OrganizationDetailDialog } from '@/features/super-admin/components/OrganizationDetailDialog'
import {
  useDeleteOrganizationMutation,
  useOrganizationsQuery,
  useReactivateOrganizationMutation,
  useSuspendOrganizationMutation,
} from '@/features/super-admin/hooks/useSuperAdminQueries'
import { formatDate } from '@/lib/utils'
import type { OrganizationListItem } from '@/features/super-admin/services/super-admin.api'

type StatusFilter = 'all' | 'active' | 'pending' | 'suspended' | 'deleted'

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deleted', label: 'Deleted' },
]

function isDeleted(org: OrganizationListItem): boolean {
  return !!org.deleted_at
}

export function OrganizationsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'suspend' | 'reactivate' | 'delete'; organization: OrganizationListItem } | null>(null)

  const { data, isLoading, error, refetch } = useOrganizationsQuery({
    page,
    limit: 20,
    status: statusFilter !== 'all' && statusFilter !== 'deleted' ? statusFilter : undefined,
    search: search || undefined,
  })

  const suspendMutation = useSuspendOrganizationMutation()
  const reactivateMutation = useReactivateOrganizationMutation()
  const deleteMutation = useDeleteOrganizationMutation()

  const organizations = useMemo(() => {
    const list = data?.organizations ?? []
    if (statusFilter === 'all') return list
    if (statusFilter === 'deleted') return list.filter(isDeleted)
    return list.filter((org) => org.status === statusFilter)
  }, [data, statusFilter])

  const confirmPending = confirmAction?.type === 'delete' ? deleteMutation : confirmAction?.type === 'suspend' ? suspendMutation : reactivateMutation
  const confirmOpen = !!confirmAction

  const handleConfirm = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'suspend') {
      suspendMutation.mutate(confirmAction.organization.id)
    } else if (confirmAction.type === 'reactivate') {
      reactivateMutation.mutate(confirmAction.organization.id)
    } else {
      deleteMutation.mutate(confirmAction.organization.id)
    }
    setConfirmAction(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage organizations on the platform."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter((value ?? 'all') as StatusFilter); setPage(1) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusFilters.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
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
                <AlertDescription>Failed to load organizations.</AlertDescription>
              </Alert>
            </div>
          ) : organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" aria-hidden="true" />
              <h3 className="text-lg font-medium text-foreground mb-2">No organizations found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search term.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Outlets</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="font-medium">{org.name}</div>
                      <div className="text-sm text-muted-foreground">/{org.slug}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={isDeleted(org) ? 'deleted' : org.status} />
                    </TableCell>
                    <TableCell>{org.subscription_plan ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{org.outlet_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{org.staff_count}</TableCell>
                    <TableCell>
                      {org.subscription_status ? (
                        <span className="text-sm">{org.subscription_status} {org.subscription_plan ? `(${org.subscription_plan})` : ''}</span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(org.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label={`Open actions for ${org.name}`} onClick={() => setDetailId(org.id)}>
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data?.pagination && data.pagination.totalPages > 1 ? (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          isLoading={isLoading}
          onPageChange={setPage}
        />
      ) : null}

      <OrganizationDetailDialog organizationId={detailId} onClose={() => setDetailId(null)} />

      {confirmAction && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(open) => { if (!open) setConfirmAction(null) }}
          title={confirmAction.type === 'delete' ? 'Delete organization?' : confirmAction.type === 'suspend' ? 'Suspend organization?' : 'Reactivate organization?'}
          description={
            confirmAction.type === 'delete'
              ? `Permanently delete "${confirmAction.organization.name}"? This cannot be undone.`
              : confirmAction.type === 'suspend'
                ? `Suspend "${confirmAction.organization.name}"?`
                : `Reactivate "${confirmAction.organization.name}"?`
          }
          confirmLabel={confirmAction.type === 'delete' ? 'Delete' : confirmAction.type === 'suspend' ? 'Suspend' : 'Reactivate'}
          pending={confirmPending.isPending}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}
