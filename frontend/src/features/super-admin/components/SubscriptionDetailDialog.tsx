'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/features/super-admin/components/StatusBadge'
import {
  changeSubscriptionPlan,
  extendSubscriptionTrial,
  fetchSubscriptionDetail,
  updateSubscriptionOverrides,
  type SubscriptionListItem,
} from '@/features/super-admin/services/super-admin.api'
import { useSubscriptionQuery } from '@/features/super-admin/hooks/useSuperAdminQueries'

interface SubscriptionDetailDialogProps {
  subscriptionId: string | null
  onClose: () => void
}

export function SubscriptionDetailDialog({ subscriptionId, onClose }: SubscriptionDetailDialogProps) {
  const queryClient = useQueryClient()
  const { data: subscription, isLoading, error } = useSubscriptionQuery(subscriptionId)

  const [overrides, setOverrides] = useState({
    max_outlets_override: '' as string,
    max_staff_override: '' as string,
    max_menu_items_override: '' as string,
  })
  const [trialDays, setTrialDays] = useState('')
  const [planId, setPlanId] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const updateOverridesMutation = useMutation({
    mutationFn: (data: { max_outlets_override: number | null; max_staff_override: number | null; max_menu_items_override: number | null }) =>
      updateSubscriptionOverrides(subscriptionId!, data),
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const extendTrialMutation = useMutation({
    mutationFn: (trialEndsAt: string) => extendSubscriptionTrial(subscriptionId!, trialEndsAt),
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const changePlanMutation = useMutation({
    mutationFn: (newPlanId: string) => changeSubscriptionPlan(subscriptionId!, { plan_id: newPlanId }),
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const handleSaveOverrides = () => {
    updateOverridesMutation.mutate({
      max_outlets_override: overrides.max_outlets_override ? Number(overrides.max_outlets_override) : null,
      max_staff_override: overrides.max_staff_override ? Number(overrides.max_staff_override) : null,
      max_menu_items_override: overrides.max_menu_items_override ? Number(overrides.max_menu_items_override) : null,
    })
  }

  const handleExtendTrial = () => {
    const days = Number(trialDays)
    if (!subscriptionId || !Number.isFinite(days) || days <= 0) return
    const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    extendTrialMutation.mutate(trialEndsAt)
  }

  return (
    <Dialog open={subscriptionId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Subscription Details</DialogTitle>
          <DialogDescription>{subscription ? `${subscription.organization_name} — ${subscription.plan_name}` : 'Loading subscription…'}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading subscription…</p>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>Failed to load subscription details.</AlertDescription>
          </Alert>
        ) : subscription ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <StatusBadge status={subscription.status} />
              <span className="text-sm text-muted-foreground">{subscription.plan_name} ({subscription.plan_code})</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 font-medium">Trial / Period</h4>
                <div className="space-y-1 text-sm">
                  <p>Trial ends: {subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : 'N/A'}</p>
                  <p>Grace ends: {subscription.grace_ends_at ? new Date(subscription.grace_ends_at).toLocaleDateString() : 'N/A'}</p>
                  <p>Period ends: {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-medium">Extend Trial</h4>
                <div className="flex gap-2">
                  <Input type="number" min="1" max="90" placeholder="Days" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="w-32" />
                  <Button onClick={handleExtendTrial} disabled={extendTrialMutation.isPending || subscription.status !== 'trialing'}>
                    {extendTrialMutation.isPending ? 'Extending...' : 'Extend'}
                  </Button>
                </div>
                {subscription.status !== 'trialing' ? (
                  <p className="mt-1 text-xs text-muted-foreground">Only trialing subscriptions can be extended.</p>
                ) : null}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 font-medium">Subscription Overrides</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="max_outlets_override">Max Outlets Override</Label>
                  <Input id="max_outlets_override" type="number" min="0" placeholder="Default" value={overrides.max_outlets_override} onChange={(e) => setOverrides({ ...overrides, max_outlets_override: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_staff_override">Max Staff Override</Label>
                  <Input id="max_staff_override" type="number" min="0" placeholder="Default" value={overrides.max_staff_override} onChange={(e) => setOverrides({ ...overrides, max_staff_override: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_menu_items_override">Max Menu Items Override</Label>
                  <Input id="max_menu_items_override" type="number" min="0" placeholder="Default" value={overrides.max_menu_items_override} onChange={(e) => setOverrides({ ...overrides, max_menu_items_override: e.target.value })} />
                </div>
              </div>
              <Button className="mt-4" onClick={handleSaveOverrides} disabled={updateOverridesMutation.isPending}>
                {updateOverridesMutation.isPending ? 'Saving...' : 'Save Overrides'}
              </Button>
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 font-medium">Change Plan</h4>
              <div className="flex gap-2">
                <Input type="text" placeholder="Plan ID" className="w-64" value={planId} onChange={(e) => setPlanId(e.target.value)} />
                <Button variant="outline" onClick={() => { if (planId) changePlanMutation.mutate(planId) }} disabled={changePlanMutation.isPending}>
                  Change Plan
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Enter the new plan ID.</p>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
