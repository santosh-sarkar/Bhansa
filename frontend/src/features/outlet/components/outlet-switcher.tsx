'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Building2, Plus, ChevronRight, Check, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { routes } from '@/config/routes'
import { fetchOutlets, createOutlet, setActiveOutlet, type Outlet } from '@/features/outlet/services/outlet.api'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

const outletSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  taxPercent: z.number().min(0, 'Tax must be 0 or more').max(100, 'Tax cannot exceed 100%'),
  serviceChargePercent: z.number().min(0, 'Service charge must be 0 or more').max(100, 'Service charge cannot exceed 100%'),
})

type OutletForm = z.infer<typeof outletSchema>

const commonTimezones = [
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'UTC',
]

function CreateOutletDialog({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<OutletForm>({
    resolver: zodResolver(outletSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      timezone: 'Asia/Kathmandu',
      taxPercent: 13,
      serviceChargePercent: 10,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: OutletForm) => createOutlet({
      name: data.name,
      address: data.address,
      phone: data.phone,
      timezone: data.timezone,
      taxPercent: data.taxPercent,
      serviceChargePercent: data.serviceChargePercent,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] })
      queryClient.invalidateQueries({ queryKey: ['outlets', 'list'] })
      reset()
      setIsOpen(false)
      setError(null)
      onSuccess()
      router.refresh()
    },
    onError: (err: Error) => {
      setError(err.message)
      setIsLoading(false)
    },
  })

  const onSubmit = (data: OutletForm) => {
    setIsLoading(true)
    setError(null)
    mutation.mutate(data)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Outlet
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Outlet</DialogTitle>
            <DialogDescription>
              Enter the details for the new outlet. Only organization owners can create outlets.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Outlet Name *</Label>
              <Input
                id="name"
                {...register('name')}
                disabled={isLoading}
                aria-invalid={!!errors.name}
                placeholder="e.g., Main Branch, Thamel"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                {...register('address')}
                disabled={isLoading}
                aria-invalid={!!errors.address}
                placeholder="Street, City, Province"
              />
              {errors.address && (
                <p className="text-sm text-destructive">{errors.address.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                disabled={isLoading}
                aria-invalid={!!errors.phone}
                placeholder="+977-1-XXXXXXX"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone *</Label>
              <Select
                value={''}
                onValueChange={(value) => setValue('timezone', value ?? '')}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {commonTimezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.timezone && (
                <p className="text-sm text-destructive">{errors.timezone.message}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxPercent">Tax % (VAT) *</Label>
                <Input
                  id="taxPercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...register('taxPercent', { valueAsNumber: true })}
                  disabled={isLoading}
                  aria-invalid={!!errors.taxPercent}
                />
                {errors.taxPercent && (
                  <p className="text-sm text-destructive">{errors.taxPercent.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceChargePercent">Service Charge % *</Label>
                <Input
                  id="serviceChargePercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...register('serviceChargePercent', { valueAsNumber: true })}
                  disabled={isLoading}
                  aria-invalid={!!errors.serviceChargePercent}
                />
                {errors.serviceChargePercent && (
                  <p className="text-sm text-destructive">{errors.serviceChargePercent.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Outlet'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function OutletSwitcher() {
  const { user, hasPermission, getCurrentOutletId, getAccessibleOutletIds } = useAuthStore()
  const currentOutletId = getCurrentOutletId()
  const accessibleOutletIds = getAccessibleOutletIds()
  const isOwner = user?.assignments.some(a => a.role === 'owner' && a.isActive)
  const canManageOutlets = hasPermission('outlets.manage')

  const { data: outlets, isLoading, refetch } = useQuery({
    queryKey: ['outlets', 'list'],
    queryFn: () => fetchOutlets({ limit: 100 }),
    enabled: isOwner || canManageOutlets,
  })

  const switchMutation = useMutation({
    mutationFn: setActiveOutlet,
    onSuccess: () => {
      refetch()
    },
  })

  const currentOutlet = outlets?.data.find(o => o.id === currentOutletId)

  const handleSwitch = (outletId: string) => {
    switchMutation.mutate(outletId)
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" className="gap-2 hidden sm:flex" disabled>
        <Building2 className="h-4 w-4 animate-pulse" />
        <span className="w-24 h-4 bg-muted animate-pulse rounded" />
        <ChevronRight className="h-4 w-4" />
      </Button>
    )
  }

  if (!outlets?.data.length || !canManageOutlets) {
    return (
      currentOutletId && (
        <Button variant="outline" size="sm" className="gap-2 hidden sm:flex" disabled>
          <Building2 className="h-4 w-4" />
          <span>{currentOutlet?.name ?? `Outlet ${currentOutletId.slice(0, 8)}`}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      )
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
          <Building2 className="h-4 w-4" />
          <span>{currentOutlet?.name ?? `Outlet ${currentOutletId?.slice(0, 8)}`}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-auto">
        <DropdownMenuLabel>Switch Outlet</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {outlets.data.map((outlet) => (
          <DropdownMenuItem
            key={outlet.id}
            className={cn(
              'flex items-center justify-between',
              outlet.id === currentOutletId && 'bg-accent'
            )}
            onSelect={() => handleSwitch(outlet.id)}
            disabled={outlet.id === currentOutletId || switchMutation.isPending}
          >
            <span className={outlet.isActive ? '' : 'text-muted-foreground'}>
              {outlet.name}
              {!outlet.isActive && ' (inactive)'}
            </span>
            {outlet.id === currentOutletId && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <CreateOutletDialog onSuccess={refetch} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { OutletSwitcher, CreateOutletDialog }