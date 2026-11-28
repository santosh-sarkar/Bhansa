'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { Check, X, AlertCircle, Clock, Users, Building2, Loader2, Plus, Edit, Trash2, Search, MoreHorizontal, Shield, CreditCard, Mail, CheckCircle, BarChart3, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useForm } from 'react-hook-form'

import { z } from 'zod'
import {
  fetchOrganizations,
  suspendOrganization,
  reactivateOrganization,
  deleteOrganization,
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan,
  fetchSubscriptions,
  updateSubscriptionOverrides,
  extendSubscriptionTrial,
  changeSubscriptionPlan,
  fetchLeads,
  markLeadHandled,
  fetchPlatformStats,
  type OrganizationListItem,
  type PlanListItem,
  type SubscriptionListItem,
  type Lead,
  type PlatformStats,
  type UpdatePlanInput,
} from '@/features/super-admin/services/super-admin.api'

// ===== Utility =====

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  deleted: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300',
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  grace: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  handled: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  true: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  false: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  waiter: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  kitchen: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
}

function StatCard({ title, value, icon: Icon, color = 'text-primary', trend }: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color?: string
  trend?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={cn('h-5 w-5', color)} aria-hidden="true" />
        </div>
        <div className="flex items-end gap-2">
          <span className="font-heading text-2xl font-bold tabular-nums">{value}</span>
          {trend && <span className="text-sm text-green-600">{trend}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ===== Organizations Tab =====

export function OrganizationsTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'organizations', page, statusFilter, search],
    queryFn: () => fetchOrganizations({ page, limit: 20, status: statusFilter || undefined, search: search || undefined }),
  })

  const suspendMutation = useMutation({
    mutationFn: suspendOrganization,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] }),
  })

  const reactivateMutation = useMutation({
    mutationFn: reactivateOrganization,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] }),
  })

  const organizations = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
            disabled={isLoading}
          />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? '')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outlets</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : organizations.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No organizations found</h3>
          <p className="text-muted-foreground">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[org.status] ?? 'bg-gray-100 text-gray-800'}>
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{org.outlet_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{org.staff_count}</TableCell>
                  <TableCell>
                    {org.subscription_status ? (
                      <Badge variant="secondary" className={statusColors[org.subscription_status] ?? 'bg-gray-100 text-gray-800'}>
                        {org.subscription_status} {org.subscription_plan ? `(${org.subscription_plan})` : ''}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(org.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Open actions menu" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {org.status !== 'deleted' && org.status !== 'suspended' && (
                          <DropdownMenuItem
                            onSelect={() => {
                              if (confirm(`Suspend "${org.name}"?`)) suspendMutation.mutate(org.id)
                            }}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Suspend
                          </DropdownMenuItem>
                        )}
                        {org.status === 'suspended' && (
                          <DropdownMenuItem
                            onSelect={() => {
                              if (confirm(`Reactivate "${org.name}"?`)) reactivateMutation.mutate(org.id)
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            if (confirm(`Permanently delete "${org.name}"? This cannot be undone.`)) deleteMutation.mutate(org.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} — {pagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages || isLoading}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ===== Plans Tab =====

export function PlansTab() {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PlanListItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: fetchPlans,
  })

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] })
      setCreating(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanInput }) => updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] }),
  })

  const plans = data?.data ?? []

  const formSchema = z.object({
    code: z.string().min(1).max(32),
    name: z.string().min(1).max(64),
    price_monthly: z.string().regex(/^\d+(\.\d{1,2})?$/),
    max_outlets: z.number().int().nonnegative(),
    max_staff: z.number().int().nullable().optional(),
    max_menu_items: z.number().int().nullable().optional(),
    multi_outlet_enabled: z.boolean(),
    is_public: z.boolean(),
  })

  type FormData = z.infer<typeof formSchema>

  const handleSubmit = (data: FormData, onSuccess: () => void, onError: (err: Error) => void) => {
    // Convert undefined to null for nullable fields
    const submitData = {
      ...data,
      max_staff: data.max_staff ?? null,
      max_menu_items: data.max_menu_items ?? null,
    }

    if (creating) {
      createMutation.mutate(submitData, { onSuccess, onError })
    } else {
      updateMutation.mutate({ id: editing!.id, data: submitData }, { onSuccess, onError })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Plans</h3>
        <Button onClick={() => { setEditing(null); setCreating(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {isLoading ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Outlets</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Menu Items</TableHead>
              <TableHead>Multi-outlet</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Subscriptions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : plans.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No plans yet</h3>
          <p className="text-muted-foreground mb-4">Create your first pricing plan.</p>
          <Button onClick={() => { setEditing(null); setCreating(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Outlets</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Menu Items</TableHead>
              <TableHead>Multi-outlet</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Subscriptions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-mono font-medium">{plan.code}</TableCell>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell className="font-mono tabular-nums">{formatCurrency(plan.price_monthly)}</TableCell>
                <TableCell className="text-right tabular-nums">{plan.max_outlets === null || plan.max_outlets < 0 ? '∞' : plan.max_outlets}</TableCell>
                <TableCell className="text-right tabular-nums">{plan.max_staff === null ? '∞' : plan.max_staff}</TableCell>
                <TableCell className="text-right tabular-nums">{plan.max_menu_items === null ? '∞' : plan.max_menu_items}</TableCell>
                <TableCell>
                  <Badge variant={plan.multi_outlet_enabled ? 'default' : 'secondary'}>
                    {plan.multi_outlet_enabled ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={plan.is_public ? 'default' : 'secondary'}>
                    {plan.is_public ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{plan.subscription_count}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Open actions menu" />}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setEditing(plan); setCreating(false) }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {plan.subscription_count === 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => {
                              if (confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) {
                                deleteMutation.mutate(plan.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background w-full max-w-md mx-4 rounded-lg border shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{creating ? 'Create Plan' : `Edit ${editing?.name}`}</h3>
              <Button variant="ghost" size="icon" onClick={() => { setCreating(false); setEditing(null) }}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <PlanForm
              initialData={editing}
              onSuccess={() => { setCreating(false); setEditing(null) }}
              onClose={() => { setCreating(false); setEditing(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function PlanForm({ initialData, onSuccess, onClose }: { initialData: PlanListItem | null; onSuccess: () => void; onClose: () => void }) {
  const isEditing = !!initialData
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<{
    code: string
    name: string
    price_monthly: string
    max_outlets: number
    max_staff: number | null
    max_menu_items: number | null
    multi_outlet_enabled: boolean
    is_public: boolean
  }>({
    defaultValues: {
      code: initialData?.code ?? '',
      name: initialData?.name ?? '',
      price_monthly: initialData?.price_monthly ?? '0',
      max_outlets: initialData?.max_outlets ?? 1,
      max_staff: initialData?.max_staff ?? null,
      max_menu_items: initialData?.max_menu_items ?? null,
      multi_outlet_enabled: initialData?.multi_outlet_enabled ?? false,
      is_public: initialData?.is_public ?? true,
    },
  })

  const onSubmit = async (data: {
    code: string
    name: string
    price_monthly: string
    max_outlets: number
    max_staff: number | null
    max_menu_items: number | null
    multi_outlet_enabled: boolean
    is_public: boolean
  }) => {
    setError(null)
    try {
      // Convert undefined to null for nullable fields
      const submitData = {
        ...data,
        max_staff: data.max_staff ?? null,
        max_menu_items: data.max_menu_items ?? null,
      }
      if (isEditing) {
        await updatePlan(initialData!.id, submitData)
      } else {
        await createPlan(submitData)
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && <Alert variant="destructive" className="gap-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="space-y-2">
        <Label htmlFor="code">Code *</Label>
        <Input id="code" {...register('code')} disabled={!isEditing} aria-invalid={!!errors.code} />
        {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="price_monthly">Monthly Price *</Label>
        <Input id="price_monthly" type="number" step="0.01" min="0" {...register('price_monthly', { valueAsNumber: true })} aria-invalid={!!errors.price_monthly} />
        {errors.price_monthly && <p className="text-sm text-destructive">{errors.price_monthly.message}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="max_outlets">Max Outlets *</Label>
          <Input id="max_outlets" type="number" min="0" {...register('max_outlets', { valueAsNumber: true })} aria-invalid={!!errors.max_outlets} />
          {errors.max_outlets && <p className="text-sm text-destructive">{errors.max_outlets.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_staff">Max Staff</Label>
          <Input id="max_staff" type="number" min="0" {...register('max_staff', { valueAsNumber: true })} placeholder="Unlimited" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_menu_items">Max Menu Items</Label>
          <Input id="max_menu_items" type="number" min="0" {...register('max_menu_items', { valueAsNumber: true })} placeholder="Unlimited" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Multi-outlet Enabled</Label>
          <Select value={watch('multi_outlet_enabled') ? 'true' : 'false'} onValueChange={(v) => setValue('multi_outlet_enabled', v === 'true')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Public</Label>
          <Select value={watch('is_public') ? 'true' : 'false'} onValueChange={(v) => setValue('is_public', v === 'true')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <Alert variant="destructive" className="gap-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  )
}

// ===== Subscriptions Tab =====

export function SubscriptionsTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'subscriptions', page, statusFilter],
    queryFn: () => fetchSubscriptions({ page, limit: 20, status: statusFilter || undefined }),
  })

  const subscriptions = data?.data ?? []
  const pagination = data?.pagination

  const overridesMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { max_outlets_override: number | null; max_staff_override: number | null; max_menu_items_override: number | null } }) => updateSubscriptionOverrides(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] }),
  })

  const extendTrialMutation = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => extendSubscriptionTrial(id, days),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] }),
  })

  const changePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { plan_id: string; prorate: boolean } }) => changeSubscriptionPlan(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] }),
  })

  const [showDetail, setShowDetail] = useState<SubscriptionListItem | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Subscriptions</h3>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? '')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="grace">Grace</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
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
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No subscriptions</h3>
        </div>
      ) : (
        <>
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
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.organization_name}</TableCell>
                  <TableCell>{sub.plan_name} ({sub.plan_code})</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[sub.status] ?? 'bg-gray-100 text-gray-800'}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{sub.trial_ends_at ? formatDate(sub.trial_ends_at) : '-'}</TableCell>
                  <TableCell>{sub.grace_ends_at ? formatDate(sub.grace_ends_at) : '-'}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {sub.max_outlets_override && <span>Outlets: {sub.max_outlets_override}</span>}
                      {sub.max_staff_override && <span>Staff: {sub.max_staff_override}</span>}
                      {sub.max_menu_items_override && <span>Menu Items: {sub.max_menu_items_override}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Open actions menu" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setShowDetail(sub)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => {
                          const days = prompt('Enter days to extend trial:')
                          if (days && !isNaN(Number(days))) {
                            extendTrialMutation.mutate({ id: sub.id, days: Number(days) })
                          }
                        }}>
                          <Clock className="h-4 w-4 mr-2" />
                          Extend Trial
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          const planId = prompt('Enter new plan ID:')
                          if (planId) {
                            const prorate = confirm('Prorate billing?')
                            changePlanMutation.mutate({ id: sub.id, data: { plan_id: planId, prorate } })
                          }
                        }}>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Change Plan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} — {pagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages || isLoading}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background w-full max-w-2xl mx-4 rounded-lg border shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{showDetail.organization_name} — {showDetail.plan_name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowDetail(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SubscriptionDetailDialog subscription={showDetail} onClose={() => setShowDetail(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

function SubscriptionDetailDialog({ subscription, onClose }: { subscription: SubscriptionListItem; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [overrides, setOverrides] = useState({
    max_outlets_override: subscription.max_outlets_override ?? '',
    max_staff_override: subscription.max_staff_override ?? '',
    max_menu_items_override: subscription.max_menu_items_override ?? '',
  })
  const [trialDays, setTrialDays] = useState('')

  const overridesMutation = useMutation({
    mutationFn: (data: { max_outlets_override: number | null; max_staff_override: number | null; max_menu_items_override: number | null }) => updateSubscriptionOverrides(subscription.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      onClose()
    },
  })

  const handleSaveOverrides = () => {
    const submitData = {
      max_outlets_override: overrides.max_outlets_override ? Number(overrides.max_outlets_override) : null,
      max_staff_override: overrides.max_staff_override ? Number(overrides.max_staff_override) : null,
      max_menu_items_override: overrides.max_menu_items_override ? Number(overrides.max_menu_items_override) : null,
    }
    overridesMutation.mutate(submitData)
  }

  const extendTrialMutation = useMutation({
    mutationFn: (days: number) => extendSubscriptionTrial(subscription.id, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      onClose()
    },
  })

  const changePlanMutation = useMutation({
    mutationFn: (data: { plan_id: string; prorate: boolean }) => changeSubscriptionPlan(subscription.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      onClose()
    },
  })

  const statusConfig = subscriptionStatusConfig[subscription.status]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className={cn('text-lg', statusColors[subscription.status] ?? 'bg-gray-100 text-gray-800')}>
          {subscription.status}
        </Badge>
        <span className="text-muted-foreground">{subscription.plan_name} ({subscription.plan_code})</span>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="font-medium mb-2">Trial / Period</h4>
          <p>Trial ends: {subscription.trial_ends_at ? formatDate(subscription.trial_ends_at) : 'N/A'}</p>
          <p>Grace ends: {subscription.grace_ends_at ? formatDate(subscription.grace_ends_at) : 'N/A'}</p>
          <p>Period ends: {subscription.current_period_end ? formatDate(subscription.current_period_end) : 'N/A'}</p>
        </div>
        <div>
          <h4 className="font-medium mb-2">Extend Trial</h4>
          <div className="flex gap-2">
            <Input type="number" min="1" max="90" placeholder="Days" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="w-32" />
            <Button onClick={() => {
              const days = Number(trialDays)
              if (days > 0) extendTrialMutation.mutate(days)
            }} disabled={!trialDays || extendTrialMutation.isPending}>
              {extendTrialMutation.isPending ? 'Extending...' : 'Extend'}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-2">Subscription Overrides</h4>
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
        <Button className="mt-4" onClick={handleSaveOverrides} disabled={overridesMutation.isPending}>
          {overridesMutation.isPending ? 'Saving...' : 'Save Overrides'}
        </Button>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-2">Change Plan</h4>
        <div className="flex gap-2">
          <Input type="text" placeholder="Plan ID" className="w-64" />
          <Button variant="outline" onClick={() => { /* changePlanMutation.mutate({ plan_id, prorate: true }) */ }}>
            Change Plan
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Enter the new plan ID. Prorate billing option coming soon.</p>
      </div>
    </div>
  )
}

// ===== Leads Tab =====

export function LeadsTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [handledFilter, setHandledFilter] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'leads', page, handledFilter],
    queryFn: () => fetchLeads({ page, limit: 20, handled: handledFilter as 'true' | 'false' | undefined }),
  })

  const markHandledMutation = useMutation({
    mutationFn: markLeadHandled,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'leads'] }),
  })

  const leads = data?.data ?? []
  const pagination = data?.pagination

  const [showDetail, setShowDetail] = useState<Lead | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Custom Plan Leads</h3>
        <Select value={handledFilter} onValueChange={(value) => setHandledFilter(value ?? '')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="true">Handled</SelectItem>
            <SelectItem value="false">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
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
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
                <TableCell><Loader2 className="h-4 w-4 animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : leads.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No leads found</h3>
        </div>
      ) : (
        <>
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
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.contact_name}</TableCell>
                  <TableCell>{lead.contact_email}</TableCell>
                  <TableCell className="text-right tabular-nums">{lead.outlet_count ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.organization_name ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[lead.handled ? 'true' : 'false']}>
                      {lead.handled ? 'Handled' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(lead.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Open actions menu" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setShowDetail(lead)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {!lead.handled && (
                          <DropdownMenuItem onSelect={() => markHandledMutation.mutate(lead.id)}>
                            <Check className="h-4 w-4 mr-2" />
                            Mark as Handled
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} — {pagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages || isLoading}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background w-full max-w-md mx-4 rounded-lg border shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Lead Details</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowDetail(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <LeadDetailDialog lead={showDetail} onClose={() => setShowDetail(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

function LeadDetailDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  return (
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

      <Separator />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!lead.handled && (
          <Button onClick={() => {
            markLeadHandled(lead.id).then(onClose)
          }}>
            <Check className="h-4 w-4 mr-2" />
            Mark as Handled
          </Button>
        )}
      </div>
    </div>
  )
}

// ===== Stats Tab =====

export function StatsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'stats'],
    queryFn: fetchPlatformStats,
    refetchInterval: 60000,
  })

  const stats = data

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const { revenue, organizations, subscriptions, plans, outlets, staff, leads, monthly_revenue } = stats

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Organizations" value={organizations.total} icon={Building2} color="text-blue-600" />
        <StatCard title="Outlets" value={outlets.total} icon={Building2} color="text-green-600" />
        <StatCard title="Staff" value={staff.total} icon={Users} color="text-purple-600" />
        <StatCard title="Leads" value={leads.total} icon={Mail} color="text-orange-600" />
      </div>

      <Separator />

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
                <span className="font-heading text-2xl font-bold tabular-nums">{formatCurrency(revenue.total_paid)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">This Month</span>
                <span className="font-heading text-2xl font-bold tabular-nums">{formatCurrency(revenue.this_month)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-heading text-2xl font-bold tabular-nums text-yellow-600">{formatCurrency(revenue.pending)}</span>
              </div>
            </div>

            {revenue.by_plan.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Revenue by Plan</h4>
                <div className="space-y-2">
                  {revenue.by_plan.map((plan) => (
                    <div key={plan.plan_code} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm">{plan.plan_name} ({plan.plan_code})</span>
                      <span className="font-medium tabular-nums">{formatCurrency(plan.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-heading text-2xl font-bold tabular-nums">{subscriptions.total}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Active</span>
                <span className="font-heading text-2xl font-bold tabular-nums text-green-600">{subscriptions.active}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Trialing</span>
                <span className="font-heading text-2xl font-bold tabular-nums text-blue-600">{subscriptions.trialing}</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between py-1 border-b">
                <span className="text-sm">Grace</span>
                <span className="font-medium text-yellow-600">{subscriptions.grace}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-sm">Suspended</span>
                <span className="font-medium text-red-600">{subscriptions.suspended}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-sm">Cancelled</span>
                <span className="font-medium text-gray-600">{subscriptions.cancelled}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plans & Staff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard title="Total Plans" value={plans.total} icon={CreditCard} color="text-primary" />
              <StatCard title="Public Plans" value={plans.public} icon={CreditCard} color="text-green-600" />
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Subscription Distribution</h4>
              <div className="space-y-2">
                {plans.subscription_distribution.map((dist) => (
                  <div key={dist.plan_id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{dist.plan_name} ({dist.plan_code})</span>
                    <span className="font-medium tabular-nums">{dist.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Staff by Role</h4>
              <div className="space-y-2">
                {staff.by_role.map((role) => (
                  <div key={role.role} className="flex items-center justify-between py-1">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className={roleColors[role.role] ?? 'bg-gray-100 text-gray-800'}>
                        {role.role}
                      </Badge>
                      <span>{role.role}</span>
                    </span>
                    <span className="font-medium tabular-nums">{role.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {monthly_revenue.length > 0 ? (
              <div className="space-y-2">
                {monthly_revenue.map((m) => (
                  <div key={m.month} className="flex justify-between py-1 border-b last:border-0">
                    <span className="text-sm">{m.month}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(m.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">No monthly revenue data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Total Leads" value={leads.total} icon={Mail} color="text-orange-600" />
            <StatCard title="Handled" value={leads.handled} icon={CheckCircle} color="text-green-600" />
            <StatCard title="Pending" value={leads.pending} icon={Clock} color="text-yellow-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Main Page =====

const subscriptionStatusConfig: Record<string, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  trialing: { label: 'Trial', icon: <Clock className="h-4 w-4" />, color: 'text-blue-600 bg-blue-50', description: 'Full access during trial period' },
  active: { label: 'Active', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600 bg-green-50', description: 'Subscription is active and in good standing' },
  grace: { label: 'Grace Period', icon: <Clock className="h-4 w-4" />, color: 'text-yellow-600 bg-yellow-50', description: 'Payment overdue - limited to read-only access' },
  suspended: { label: 'Suspended', icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-600 bg-red-50', description: 'Subscription suspended - access blocked' },
  cancelled: { label: 'Cancelled', icon: <X className="h-4 w-4" />, color: 'text-gray-600 bg-gray-50', description: 'Subscription cancelled - no access' },
}

export default function SuperAdminPage() {
  const { hasRole } = useAuthStore()

  if (!hasRole('super_admin')) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          You need Super Admin role to access this page.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Shield className="h-8 w-8" aria-hidden="true" />
          Super Admin Panel
        </h1>
        <p className="text-muted-foreground">Platform-wide management: organizations, plans, subscriptions, leads, and analytics.</p>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="organizations">
            <Building2 className="h-4 w-4 mr-2" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="plans">
            <CreditCard className="h-4 w-4 mr-2" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <Users className="h-4 w-4 mr-2" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="leads">
            <Mail className="h-4 w-4 mr-2" />
            Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <StatsTab />
        </TabsContent>

        <TabsContent value="organizations" className="mt-4">
          <OrganizationsTab />
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <PlansTab />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <SubscriptionsTab />
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <LeadsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}