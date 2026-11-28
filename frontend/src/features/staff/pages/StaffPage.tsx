'use client'

import { unstable_noStore } from 'next/cache'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, User, Loader2, MoreHorizontal, Trash2, Edit, AlertTriangle, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { routes } from '@/config/routes'
import { StaffAssignmentsDialog } from '@/features/staff/components/staff-assignments-dialog'
import { useAuthStore } from '@/store/authStore'
import { getPrimaryRole } from '@/lib/roleUtils'
import {
  fetchStaff,
  fetchInvitations,
  createInvitation,
  revokeInvitation,
  deactivateStaff,
  updateStaffAssignments,
  type StaffMember,
  type Invitation,
  type CreateInvitationInput,
} from '@/features/staff/services/staff.api'

const roles = [
  { value: 'manager', label: 'Manager' },
  { value: 'waiter', label: 'Waiter' },
  { value: 'kitchen', label: 'Kitchen' },
] as const

// Role badge styles using semantic CSS variables
const roleColors: Record<string, string> = {
  owner: 'bg-[var(--role-owner-bg)] text-[var(--role-owner)]',
  manager: 'bg-[var(--role-manager-bg)] text-[var(--role-manager)]',
  waiter: 'bg-[var(--role-waiter-bg)] text-[var(--role-waiter)]',
  kitchen: 'bg-[var(--role-kitchen-bg)] text-[var(--role-kitchen)]',
}

// Status badge styles using semantic CSS variables
const statusColors: Record<string, string> = {
  pending: 'bg-[var(--invite-pending-bg)] text-[var(--invite-pending)]',
  accepted: 'bg-[var(--invite-accepted-bg)] text-[var(--invite-accepted)]',
  expired: 'bg-[var(--invite-expired-bg)] text-[var(--invite-expired)]',
  revoked: 'bg-[var(--invite-revoked-bg)] text-[var(--invite-revoked)]',
  active: 'bg-[var(--status-ready-bg)] text-[var(--status-ready)]',
  inactive: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]',
}

function StaffTable({
  staff,
  isLoading,
  onAssignments,
  staffRoute,
}: { staff: StaffMember[]; isLoading: boolean; onAssignments: (member: StaffMember) => void; staffRoute: string }) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Outlets</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No staff members</h3>
        <p className="text-muted-foreground">Invite your first team member to get started.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead>Outlets</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium">{member.fullName}</TableCell>
            <TableCell>{member.email}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {member.assignments.map((a) => (
                  <Badge
                    key={a.id}
                    variant="secondary"
                    className={cn(roleColors[a.role] ?? 'bg-gray-100 text-gray-800')}
                  >
                    {a.role.charAt(0).toUpperCase() + a.role.slice(1)}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {member.assignments
                  .filter((a) => a.outletName)
                  .map((a) => (
                    <Badge key={a.id} variant="outline" className="text-xs">
                      {a.outletName}
                    </Badge>
                  ))}
                {member.assignments.some((a) => !a.outletId) && (
                  <Badge variant="outline" className="text-xs">All Outlets</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className={cn(statusColors[member.isActive ? 'active' : 'inactive'])}>
                {member.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Open actions menu" />}>
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => window.location.href = `${staffRoute}/${member.id}`}>
                    <Edit className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onAssignments(member)}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Assignments
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (confirm(`Deactivate ${member.fullName}? This will revoke all their sessions.`)) {
                        window.dispatchEvent(new CustomEvent('deactivate-staff', { detail: member.id }))
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deactivate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function InviteDialog({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState<CreateInvitationInput>({
    email: '',
    role: 'waiter',
    outletId: undefined,
  })
  const [error, setError] = useState<string | null>(null)
  const { getAccessibleOutletIds } = useAuthStore()

  const mutation = useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      setIsOpen(false)
      setFormData({ email: '', role: 'waiter', outletId: undefined })
      setError(null)
      onSuccess()
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  const outlets = getAccessibleOutletIds()

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Invite Staff
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
            <DialogDescription>
              Enter their email and assign a role. They&apos;ll receive an invitation email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="staff@restaurant.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={mutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as CreateInvitationInput['role'] })}
                  disabled={mutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(formData.role === 'manager' || formData.role === 'waiter' || formData.role === 'kitchen') && outlets.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="outletId">Outlet</Label>
                  <Select
                    value={formData.outletId ?? ''}
                    onValueChange={(value) => setFormData({ ...formData, outletId: value || undefined })}
                    disabled={mutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outlet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Outlets (Owner only)</SelectItem>
                      {outlets.map((id) => (
                        <SelectItem key={id} value={id}>Outlet {id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {error && (
                <Alert variant="destructive" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Invitation'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function InvitationsTable({ invitations, isLoading, onRevoke }: { invitations: Invitation[]; isLoading: boolean; onRevoke: (id: string) => void }) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Outlet</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(3)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pending invitations.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Outlet</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((inv) => (
          <TableRow key={inv.id}>
            <TableCell>{inv.email}</TableCell>
            <TableCell>
              <Badge variant="secondary" className={roleColors[inv.role]}>
                {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)}
              </Badge>
            </TableCell>
            <TableCell>{inv.outletName ?? 'All Outlets'}</TableCell>
            <TableCell>
              <Badge variant="secondary" className={statusColors[inv.status]}>
                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
              </Badge>
            </TableCell>
            <TableCell>{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
            <TableCell className="text-right">
              {inv.status === 'pending' && (
                <Button variant="ghost" size="icon" onClick={() => onRevoke(inv.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function StaffPage() {
  unstable_noStore()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const primaryRole = getPrimaryRole(user)
  const staffRoute = primaryRole === 'owner' ? routes.ownerStaff : routes.managerStaff
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [assignmentsStaff, setAssignmentsStaff] = useState<StaffMember | null>(null)

  const assignmentsMutation = useMutation({
    mutationFn: ({ staffId, outletIds }: { staffId: string; outletIds: string[] }) =>
      updateStaffAssignments(staffId, { outletIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'list'] })
      setAssignmentsStaff(null)
    },
  })

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', 'list', search, statusFilter],
    queryFn: () => fetchStaff({ page: 1, limit: 50, status: statusFilter || undefined }),
  })

  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['staff', 'invitations'],
    queryFn: () => fetchInvitations({ page: 1, limit: 50 }),
  })

  const inviteMutation = useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'invitations'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'invitations'] })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'list'] })
    },
  })

  // Handle deactivate from dropdown
  useEffect(() => {
    const handleDeactivate = (e: CustomEvent<string>) => {
      if (confirm('Deactivate this staff member? This will revoke all their sessions.')) {
        deactivateMutation.mutate(e.detail)
      }
    }
    window.addEventListener('deactivate-staff', handleDeactivate as EventListener)
    return () => window.removeEventListener('deactivate-staff', handleDeactivate as EventListener)
  }, [deactivateMutation])

  const filteredStaff = staffData?.data.filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const handleAssignments = (member: StaffMember) => {
    setAssignmentsStaff(member)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground">Manage your team members and invitations</p>
        </div>
        <InviteDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ['staff', 'invitations'] })} />
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Team Members</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
              disabled={staffLoading}
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? '')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <StaffTable
            staff={filteredStaff}
            isLoading={staffLoading}
            onAssignments={handleAssignments}
            staffRoute={staffRoute}
          />
        </CardContent>
      </Card>

      {/* Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <InvitationsTable
            invitations={invitationsData?.data ?? []}
            isLoading={invitationsLoading}
            onRevoke={(id) => {
              if (confirm('Revoke this invitation?')) {
                revokeMutation.mutate(id)
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Staff Assignments Dialog */}
      <StaffAssignmentsDialog
        staff={assignmentsStaff!}
        open={!!assignmentsStaff}
        onOpenChange={open => !open && setAssignmentsStaff(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['staff', 'list'] })}
      />
    </div>
  )
}

import { useEffect } from 'react'