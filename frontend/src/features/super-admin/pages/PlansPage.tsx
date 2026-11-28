'use client'

import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PlanFormDialog } from '@/features/super-admin/components/PlanFormDialog'
import { ConfirmDialog } from '@/features/super-admin/components/ConfirmDialog'
import { PageHeader } from '@/features/super-admin/components/PageHeader'
import { useDeletePlanMutation, usePlansQuery, useUpdatePlanMutation } from '@/features/super-admin/hooks/useSuperAdminQueries'
import { formatCurrency } from '@/lib/utils'
import type { PlanListItem } from '@/features/super-admin/services/super-admin.api'

export function PlansPage() {
  const { data, isLoading, error } = usePlansQuery()
  const updatePlanMutation = useUpdatePlanMutation()
  const deletePlanMutation = useDeletePlanMutation()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PlanListItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<PlanListItem | null>(null)

  const plans = data?.plans ?? []

  const openCreate = () => {
    setEditing(null)
    setCreating(true)
    setFormOpen(true)
  }

  const openEdit = (plan: PlanListItem) => {
    setEditing(plan)
    setCreating(false)
    setFormOpen(true)
  }

  const handleDelete = () => {
    if (!deleting) return
    deletePlanMutation.mutate(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Subscription pricing plans."
        actions={
          <Button onClick={openCreate}>
            Create Plan
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>Failed to load plans.</AlertDescription>
        </Alert>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">No plans yet</h3>
            <p className="text-muted-foreground mb-4">Create your first pricing plan.</p>
            <Button onClick={openCreate}>
              Create Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="font-mono text-xs">{plan.code}</span>
                    </CardDescription>
                  </div>
                  {plan.is_public ? (
                    <Badge variant="secondary">Public</Badge>
                  ) : (
                    <Badge variant="outline">Private</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="font-heading text-2xl font-bold tabular-nums">{formatCurrency(plan.price_monthly)}</span>
                  <span className="text-sm text-muted-foreground"> /month</span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max outlets</span>
                    <span className="font-medium">{plan.max_outlets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max staff</span>
                    <span className="font-medium">{plan.max_staff ?? 'Unlimited'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max menu items</span>
                    <span className="font-medium">{plan.max_menu_items ?? 'Unlimited'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {plan.multi_outlet_enabled ? <Badge>Multi-outlet</Badge> : null}
                  <span className="text-sm text-muted-foreground">{plan.subscription_count} subscriptions</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => openEdit(plan)} disabled={updatePlanMutation.isPending}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(plan)} disabled={updatePlanMutation.isPending || plan.subscription_count > 0}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlanFormDialog open={formOpen} onOpenChange={setFormOpen} plan={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title={`Delete plan "${deleting?.name}"?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        pending={deletePlanMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
