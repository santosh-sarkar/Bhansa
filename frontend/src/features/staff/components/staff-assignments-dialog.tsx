'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchOutlets, type Outlet } from '@/features/outlet/services/outlet.api'
import { updateStaffAssignments, type StaffMember } from '@/features/staff/services/staff.api'

interface StaffAssignmentsDialogProps {
  staff: StaffMember
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  waiter: 'Waiter',
  kitchen: 'Kitchen',
}

export function StaffAssignmentsDialog({ staff, open, onOpenChange, onSuccess }: StaffAssignmentsDialogProps) {
  const queryClient = useQueryClient()
  const assignments = staff?.assignments ?? []
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>(
    assignments.map(a => a.outletId).filter(Boolean) as string[]
  )
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [isLoadingOutlets, setIsLoadingOutlets] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOwner = assignments.some(a => a.role === 'owner' && a.isActive)
  const isWaiterOrKitchen = assignments.some(
    a => (a.role === 'waiter' || a.role === 'kitchen') && a.isActive
  )

  // Fetch outlets on open
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoadingOutlets(true)
      fetchOutlets({ limit: 100, isActive: true })
        .then(res => {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setOutlets(res.data)
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setIsLoadingOutlets(false)
        })
        .catch(err => {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setError(err.message)
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setIsLoadingOutlets(false)
        })
    }
  }, [open])

  // Reset selections when dialog opens/closes
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOutlets(
        assignments.map(a => a.outletId).filter(Boolean) as string[]
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null)
    }
  }, [open, assignments])

  const mutation = useMutation({
    mutationFn: (outletIds: string[]) => updateStaffAssignments(staff.id, { outletIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      onSuccess()
      onOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleOutletChange = (outletId: string, checked: boolean) => {
    setSelectedOutlets(prev => {
      if (isWaiterOrKitchen) {
        // Waiter/Kitchen: only one outlet allowed
        return checked ? [outletId] : []
      }
      return checked
        ? [...prev, outletId]
        : prev.filter(id => id !== outletId)
    })
  }

  const handleSubmit = () => {
    if (isWaiterOrKitchen && selectedOutlets.length !== 1) {
      setError('Waiter and Kitchen roles must be assigned to exactly one outlet')
      return
    }
    mutation.mutate(selectedOutlets)
  }

  const currentRoles = assignments
    .filter(a => a.isActive)
    .map(a => roleLabels[a.role] ?? a.role)
    .join(', ')

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Outlet Assignments</DialogTitle>
          <DialogDescription>
            {staff.fullName} ({staff.email}) — Current roles: {currentRoles}
          </DialogDescription>
        </DialogHeader>

        {isOwner ? (
          <div className="py-4 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Owners have organization-wide access and cannot be assigned to specific outlets.</p>
            <p className="text-sm mt-1">To change an Owner&apos;s role, use the role change option instead.</p>
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label className="font-medium">Select Outlets</Label>
              <p className="text-sm text-muted-foreground">
                {isWaiterOrKitchen
                  ? 'Waiter and Kitchen roles can only be assigned to one outlet.'
                  : 'Manager roles can be assigned to multiple outlets.'}
              </p>

              {isLoadingOutlets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : outlets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No active outlets available.</p>
              ) : (
                <ScrollArea className="h-[300px] space-y-2">
                  {outlets.map(outlet => (
                    <label
                      key={outlet.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50',
                        selectedOutlets.includes(outlet.id) && 'bg-accent border-primary'
                      )}
                    >
                      <Checkbox
                        checked={selectedOutlets.includes(outlet.id)}
                        onCheckedChange={checked => handleOutletChange(outlet.id, checked)}
                        disabled={mutation.isPending}
                      />
                      <div className="flex-1">
                        <span className={outlet.isActive ? 'font-medium' : 'text-muted-foreground'}>
                          {outlet.name}
                        </span>
                        {outlet.address && (
                          <p className="text-xs text-muted-foreground">{outlet.address}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </ScrollArea>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={mutation.isPending || isWaiterOrKitchen && selectedOutlets.length !== 1}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Assignments'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}