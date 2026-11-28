'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useLeadQuery, useMarkLeadHandledMutation } from '@/features/super-admin/hooks/useSuperAdminQueries'
import type { Lead } from '@/features/super-admin/services/super-admin.api'

interface LeadDetailDialogProps {
  leadId: string | null
  onClose: () => void
}

export function LeadDetailDialog({ leadId, onClose }: LeadDetailDialogProps) {
  const queryClient = useQueryClient()
  const { data: lead, isLoading, error } = useLeadQuery(leadId)

  const markHandledMutation = useMarkLeadHandledMutation()

  const handleMarkHandled = () => {
    if (!lead) return
    markHandledMutation.mutate(lead.id)
    onClose()
  }

  return (
    <Dialog open={leadId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lead Details</DialogTitle>
          <DialogDescription>{lead ? lead.contact_name : 'Loading lead…'}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading lead…</p>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>Failed to load lead details.</AlertDescription>
          </Alert>
        ) : lead ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{lead.contact_name}</h4>
              <p className="text-muted-foreground">{lead.contact_email}</p>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Outlets Requested</h4>
                <p>{lead.outlet_count ?? 'Not specified'}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Organization</h4>
                <p className="text-muted-foreground">{lead.organization_name ?? 'Not linked'}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Message</h4>
              <p className="whitespace-pre-wrap">{lead.message ?? 'No message provided'}</p>
            </div>
          </div>
        ) : null}

        {markHandledMutation.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{markHandledMutation.error?.message ?? 'Failed to mark lead as handled.'}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {!lead?.handled && (
              <Button onClick={handleMarkHandled} disabled={markHandledMutation.isPending}>
                {markHandledMutation.isPending ? 'Marking...' : 'Mark as Handled'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
