'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, ShieldCheck, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/features/super-admin/components/StatusBadge'
import {
  deleteOrganization,
  reactivateOrganization,
  suspendOrganization,
} from '@/features/super-admin/services/super-admin.api'
import { useOrganizationDetailQuery } from '@/features/super-admin/hooks/useSuperAdminQueries'

interface OrganizationDetailDialogProps {
  organizationId: string | null
  onClose: () => void
}

export function OrganizationDetailDialog({ organizationId, onClose }: OrganizationDetailDialogProps) {
  const queryClient = useQueryClient()
  const { data: organization, isLoading, error } = useOrganizationDetailQuery(organizationId)

  const [actionError, setActionError] = useState<string | null>(null)

  const suspendMutation = useMutation({
    mutationFn: () => suspendOrganization(organizationId!),
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateOrganization(organizationId!),
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrganization(organizationId!),
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
      onClose()
    },
    onError: (err: Error) => setActionError(err.message),
  })

  return (
    <Dialog open={organizationId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            {organization ? organization.name : 'Organization'}
          </DialogTitle>
          <DialogDescription>{organization ? `/${organization.slug}` : 'Loading organization details…'}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading organization…</p>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>Failed to load organization details.</AlertDescription>
          </Alert>
        ) : organization ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <StatusBadge status={organization.status} />
              <span className="text-sm text-muted-foreground">Created {new Date(organization.created_at).toLocaleDateString()}</span>
            </div>

            <div>
              <h4 className="mb-2 font-medium">Outlets</h4>
              {organization.outlets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outlets.</p>
              ) : (
                <div className="space-y-2">
                  {organization.outlets.map((outlet) => (
                    <div key={outlet.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="font-medium">{outlet.name}</p>
                        <p className="text-sm text-muted-foreground">Active: {outlet.is_active ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 font-medium">Staff</h4>
              {organization.staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff members.</p>
              ) : (
                <div className="space-y-2">
                  {organization.staff.map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="font-medium">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{member.role}</span>
                        <StatusBadge status={member.is_active ? 'active' : 'inactive'} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 font-medium">Subscription</h4>
              {organization.subscription ? (
                <div className="space-y-1 text-sm">
                  <p>Plan: {organization.subscription.plan_name ?? 'Unknown'}</p>
                  <p>Status: {organization.subscription.status}</p>
                  <p>Trial ends: {organization.subscription.trial_ends_at ? new Date(organization.subscription.trial_ends_at).toLocaleDateString() : 'N/A'}</p>
                  <p>Grace ends: {organization.subscription.grace_ends_at ? new Date(organization.subscription.grace_ends_at).toLocaleDateString() : 'N/A'}</p>
                  <p>Period ends: {organization.subscription.current_period_end ? new Date(organization.subscription.current_period_end).toLocaleDateString() : 'N/A'}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No subscription.</p>
              )}
            </div>

            {organization.custom_plan_lead ? (
              <>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">Custom Plan Lead</h4>
                  <div className="space-y-1 text-sm">
                    <p>{organization.custom_plan_lead.contact_name}</p>
                    <p className="text-muted-foreground">{organization.custom_plan_lead.contact_email}</p>
                    <p>Handled: {organization.custom_plan_lead.handled ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {actionError ? (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            {organization && organization.status !== 'suspended' && organization.status !== 'deleted' ? (
              <Button variant="outline" size="sm" onClick={() => suspendMutation.mutate()} disabled={suspendMutation.isPending}>
                <ShieldCheck className="h-4 w-4 mr-2" aria-hidden="true" />
                Suspend
              </Button>
            ) : null}
            {organization && organization.status === 'suspended' ? (
              <Button variant="outline" size="sm" onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}>
                Reactivate
              </Button>
            ) : null}
            {organization && organization.status !== 'deleted' ? (
              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
