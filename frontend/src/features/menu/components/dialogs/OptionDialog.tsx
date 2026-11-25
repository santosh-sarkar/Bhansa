'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMenuDialogs } from '../MenuDialogContext'
import { createMenuItemOption, updateMenuItemOption, type MenuItemOption, type CreateOptionInput, type UpdateOptionInput } from '@/features/menu/services/menu.api'

const optionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  kind: z.enum(['variant', 'addon']),
  priceDelta: z.number(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().min(0).optional(),
})

type OptionForm = z.infer<typeof optionSchema>

interface OptionDialogProps {}

export function OptionDialog() {
  const { editingOption, creatingOptionItemId, closeEditOption, closeCreateOption } = useMenuDialogs()
  const queryClient = useQueryClient()
  
  const isEditing = !!editingOption
  const isCreating = !!creatingOptionItemId
  const isOpen = isEditing || isCreating
  const menuItemId = editingOption?.menuItemId ?? creatingOptionItemId ?? ''
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: OptionForm) => 
      isEditing ? updateMenuItemOption(editingOption!.option.id, data) : createMenuItemOption(menuItemId, data),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] })
      if (isEditing) closeEditOption()
      else closeCreateOption()
    },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<OptionForm>({
    resolver: zodResolver(optionSchema),
    defaultValues: {
      name: editingOption?.option.name ?? '',
      kind: editingOption?.option.kind ?? 'variant',
      priceDelta: editingOption?.option.priceDelta ?? 0,
      isActive: editingOption?.option.isActive ?? true,
      displayOrder: editingOption?.option.displayOrder ?? 0,
    },
  })

  const kindValue = watch('kind') ?? 'variant'

  const onSubmit = (data: OptionForm) => mutation.mutate(data)

  if (!isOpen) return null

  return (
    <Dialog open={true} onOpenChange={isEditing ? closeEditOption : closeCreateOption}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Option' : 'Add Option'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} disabled={mutation.isPending} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-sm text-destructive" role="alert">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="kind">Type</Label>
              <select
                value={kindValue}
                onChange={(e) => setValue('kind', e.target.value as 'variant' | 'addon')}
                disabled={mutation.isPending}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                <option value="variant">Variant</option>
                <option value="addon">Addon</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceDelta">Price Delta (Rs)</Label>
                <Input id="priceDelta" type="number" step="0.01" {...register('priceDelta', { valueAsNumber: true })} disabled={mutation.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input id="displayOrder" type="number" min="0" {...register('displayOrder', { valueAsNumber: true })} disabled={mutation.isPending} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" {...register('isActive')} disabled={mutation.isPending} />
              <Label htmlFor="isActive">Active</Label>
            </div>
            {error && <Alert variant="destructive" className="gap-2"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={isEditing ? closeEditOption : closeCreateOption} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : (isEditing ? 'Update' : 'Add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}