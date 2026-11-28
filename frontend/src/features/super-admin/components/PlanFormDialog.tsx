'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreatePlanMutation, useUpdatePlanMutation } from '@/features/super-admin/hooks/useSuperAdminQueries'
import { type CreatePlanInput, type PlanListItem } from '@/features/super-admin/services/super-admin.api'

const planSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  price_monthly: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid price'),
  max_outlets: z.string().regex(/^\d*$/, 'Must be a number'),
  max_staff: z.string().optional().nullable(),
  max_menu_items: z.string().optional().nullable(),
  multi_outlet_enabled: z.boolean(),
  is_public: z.boolean(),
})

type PlanFormValues = z.infer<typeof planSchema>

interface PlanFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanListItem | null
}

export function PlanFormDialog({ open, onOpenChange, plan }: PlanFormDialogProps) {
  const createPlanMutation = useCreatePlanMutation()
  const updatePlanMutation = useUpdatePlanMutation()

  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      code: plan?.code ?? '',
      name: plan?.name ?? '',
      price_monthly: plan?.price_monthly ?? '0',
      max_outlets: String(plan?.max_outlets ?? 1),
      max_staff: plan?.max_staff != null ? String(plan.max_staff) : '',
      max_menu_items: plan?.max_menu_items != null ? String(plan.max_menu_items) : '',
      multi_outlet_enabled: plan?.multi_outlet_enabled ?? false,
      is_public: plan?.is_public ?? true,
    },
  })

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setError(null)
      reset({
        code: plan?.code ?? '',
        name: plan?.name ?? '',
        price_monthly: plan?.price_monthly ?? '0',
        max_outlets: String(plan?.max_outlets ?? 1),
        max_staff: plan?.max_staff != null ? String(plan.max_staff) : '',
        max_menu_items: plan?.max_menu_items != null ? String(plan.max_menu_items) : '',
        multi_outlet_enabled: plan?.multi_outlet_enabled ?? false,
        is_public: plan?.is_public ?? true,
      })
    }
  }

  const onSubmit = (values: PlanFormValues) => {
    const payload: CreatePlanInput = {
      code: values.code,
      name: values.name,
      price_monthly: values.price_monthly,
      max_outlets: Number(values.max_outlets),
      max_staff: values.max_staff && values.max_staff !== '' ? Number(values.max_staff) : null,
      max_menu_items: values.max_menu_items && values.max_menu_items !== '' ? Number(values.max_menu_items) : null,
      multi_outlet_enabled: values.multi_outlet_enabled,
      is_public: values.is_public,
      features: {},
    }
    if (plan) {
      updatePlanMutation.mutate(
        { id: plan.id, data: { name: values.name, price_monthly: values.price_monthly, max_outlets: Number(values.max_outlets), max_staff: values.max_staff && values.max_staff !== '' ? Number(values.max_staff) : null, max_menu_items: values.max_menu_items && values.max_menu_items !== '' ? Number(values.max_menu_items) : null, multi_outlet_enabled: values.multi_outlet_enabled, is_public: values.is_public } },
        { onSuccess: () => handleDialogOpenChange(false) },
      )
    } else {
      createPlanMutation.mutate(payload, { onSuccess: () => handleDialogOpenChange(false) })
    }
  }

  const multiOutlet = watch('multi_outlet_enabled')
  const isPublic = watch('is_public')

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
          <DialogDescription>{plan ? `Editing ${plan.name}` : 'Create a new pricing plan'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

          <div className="space-y-2">
            <Label htmlFor="code">Code *</Label>
            <Input id="code" {...register('code')} disabled={!!plan} aria-invalid={!!errors.code} />
            {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_monthly">Monthly Price *</Label>
            <Input id="price_monthly" type="number" step="0.01" min="0" {...register('price_monthly')} />
            {errors.price_monthly ? <p className="text-sm text-destructive">{errors.price_monthly.message}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="max_outlets">Max Outlets *</Label>
              <Input id="max_outlets" type="number" min="0" {...register('max_outlets')} />
              {errors.max_outlets ? <p className="text-sm text-destructive">{errors.max_outlets.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_staff">Max Staff</Label>
              <Input id="max_staff" type="number" min="0" {...register('max_staff')} placeholder="Unlimited" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_menu_items">Max Menu Items</Label>
              <Input id="max_menu_items" type="number" min="0" {...register('max_menu_items')} placeholder="Unlimited" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div>
                <Label htmlFor="multi_outlet_enabled">Multi-outlet Enabled</Label>
              </div>
              <Switch id="multi_outlet_enabled" checked={Boolean(multiOutlet)} onCheckedChange={(v) => setValue('multi_outlet_enabled', v)} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div>
                <Label htmlFor="is_public">Public</Label>
              </div>
              <Switch id="is_public" checked={Boolean(isPublic)} onCheckedChange={(v) => setValue('is_public', v)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || createPlanMutation.isPending || updatePlanMutation.isPending}>
              {isSubmitting || createPlanMutation.isPending || updatePlanMutation.isPending ? 'Saving...' : plan ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}