'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Loader2, Save, Building2, MapPin, Phone, Globe, Percent, Settings } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/store/authStore'
import { fetchOutlet, updateOutlet, type Outlet } from '@/features/outlet/services/outlet.api'


const outletSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  taxPercent: z.number().min(0, 'Tax must be 0 or more').max(100, 'Tax cannot exceed 100%'),
  serviceChargePercent: z.number().min(0, 'Service charge must be 0 or more').max(100, 'Service charge cannot exceed 100%'),
})

type OutletForm = z.infer<typeof outletSchema>

function OutletFormSection({ outlet, isLoading }: { outlet: Outlet; isLoading: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<OutletForm>({
    resolver: zodResolver(outletSchema),
    defaultValues: {
      name: outlet.name,
      address: outlet.address,
      phone: outlet.phone,
      timezone: outlet.timezone,
      taxPercent: outlet.taxPercent,
      serviceChargePercent: outlet.serviceChargePercent,
    },
  })

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: OutletForm) => updateOutlet(outlet.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet', outlet.id] })
    },
  })

  const onSubmit = (data: OutletForm) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Outlet Name</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              {...register('name')}
              disabled={isLoading || mutation.isPending}
              className="pl-10"
              aria-invalid={!!errors.name}
            />
          </div>
          {errors.name && <p className="text-sm text-destructive" role="alert">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="address"
              {...register('address')}
              disabled={isLoading || mutation.isPending}
              className="pl-10"
              aria-invalid={!!errors.address}
            />
          </div>
          {errors.address && <p className="text-sm text-destructive" role="alert">{errors.address.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              {...register('phone')}
              disabled={isLoading || mutation.isPending}
              className="pl-10"
              aria-invalid={!!errors.phone}
            />
          </div>
          {errors.phone && <p className="text-sm text-destructive" role="alert">{errors.phone.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="timezone"
              {...register('timezone')}
              disabled={isLoading || mutation.isPending}
              className="pl-10"
              aria-invalid={!!errors.timezone}
            />
          </div>
          {errors.timezone && <p className="text-sm text-destructive" role="alert">{errors.timezone.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxPercent">Tax % (VAT)</Label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="taxPercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register('taxPercent', { valueAsNumber: true })}
              disabled={isLoading || mutation.isPending}
              className="pl-10"
              aria-invalid={!!errors.taxPercent}
            />
          </div>
          {errors.taxPercent && <p className="text-sm text-destructive" role="alert">{errors.taxPercent.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="serviceChargePercent">Service Charge %</Label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="serviceChargePercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register('serviceChargePercent', { valueAsNumber: true })}
              disabled={isLoading || mutation.isPending}
              className="pl-10"
              aria-invalid={!!errors.serviceChargePercent}
            />
          </div>
          {errors.serviceChargePercent && <p className="text-sm text-destructive" role="alert">{errors.serviceChargePercent.message}</p>}
        </div>
      </div>

      <CardFooter className="flex justify-end">
        <Button type="submit" disabled={isLoading || mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </CardFooter>
    </form>
  )
}

function DeactivateSection({ outletId, outletName, isActive }: { outletId: string; outletName: string; isActive: boolean }) {
  const queryClient = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)

  const mutation = useMutation({
    mutationFn: () => import('@/features/outlet/services/outlet.api').then(m => m.deactivateOutlet(outletId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet', outletId] })
      setShowConfirm(false)
    },
  })

  if (!isActive) {
    return (
      <Alert className="border-destructive/20 bg-destructive/5">
        <AlertDescription className="flex items-center justify-between">
          <span>This outlet is deactivated. No new orders can be placed.</span>
          <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)}>
            Reactivate
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
      <AlertDescription className="flex items-center justify-between">
        <span>Deactivating will block new orders but keep all history.</span>
        <Button variant="outline" onClick={() => setShowConfirm(true)} disabled={mutation.isPending}>
          Deactivate Outlet
        </Button>
      </AlertDescription>
    </Alert>
  )
}

export default function OutletPage() {
  const { getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  const { data: outlet, isLoading, error } = useQuery({
    queryKey: ['outlet', outletId],
    queryFn: () => fetchOutlet(outletId!),
    enabled: !!outletId,
  })

  if (!outletId) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">No outlet selected</h2>
        <p className="text-muted-foreground">Please select an outlet from the header to manage its settings.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Outlet Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load outlet settings: {error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!outlet) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Outlet not found</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{outlet.name}</h1>
        <p className="text-muted-foreground">Manage outlet settings, tax, and service charges.</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <OutletFormSection outlet={outlet} isLoading={isLoading} />
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Outlet Status</CardTitle>
            </CardHeader>
            <CardContent>
              <DeactivateSection
                outletId={outlet.id}
                outletName={outlet.name}
                isActive={outlet.isActive}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}