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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMenuDialogs } from '../MenuDialogContext'
import { createMenuItem, updateMenuItem, uploadMenuImage, type MenuItem, type Category, type CreateMenuItemInput, type UpdateMenuItemInput } from '@/features/menu/services/menu.api'

const menuItemSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0, 'Price must be 0 or more'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isVegetarian: z.boolean().optional(),
  displayOrder: z.number().min(0).optional(),
})

type MenuItemForm = z.infer<typeof menuItemSchema>

interface MenuItemDialogProps {
  categories: Category[]
}

export function MenuItemDialog({ categories }: MenuItemDialogProps) {
  const { editingItem, creatingItem, closeEditItem, closeCreateItem } = useMenuDialogs()
  const queryClient = useQueryClient()
  
  const isEditing = !!editingItem
  const isOpen = isEditing || creatingItem
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(editingItem?.imageUrl ?? null)
  const [isUploading, setIsUploading] = useState(false)

  const mutation = useMutation({
    mutationFn: (data: MenuItemForm) => isEditing ? updateMenuItem(editingItem!.id, data) : createMenuItem(data),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] })
      if (isEditing) closeEditItem()
      else closeCreateItem()
    },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<MenuItemForm>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      categoryId: editingItem?.categoryId ?? categories[0]?.id ?? '',
      name: editingItem?.name ?? '',
      description: editingItem?.description ?? '',
      price: editingItem?.price ?? 0,
      imageUrl: editingItem?.imageUrl ?? '',
      isVegetarian: editingItem?.isVegetarian ?? false,
      displayOrder: editingItem?.displayOrder ?? 0,
    },
  })

  const categoryIdValue = watch('categoryId') ?? ''

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const { url } = await uploadMenuImage(file)
      setImagePreview(url)
      setValue('imageUrl', url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const onSubmit = (data: MenuItemForm) => {
    mutation.mutate(data)
  }

  if (!isOpen) return null

  return (
    <Dialog open={true} onOpenChange={isEditing ? closeEditItem : closeCreateItem}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Menu Item' : 'Create Menu Item'}</DialogTitle>
          <DialogDescription>{isEditing ? 'Update menu item details.' : 'Add a new menu item.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <select
                {...register('categoryId')}
                disabled={mutation.isPending}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                  errors.categoryId && 'border-destructive'
                )}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.categoryId && <p className="text-sm text-destructive" role="alert">{errors.categoryId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} disabled={mutation.isPending} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-sm text-destructive" role="alert">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register('description')} placeholder="Optional" disabled={mutation.isPending} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Price (Rs)</Label>
                <Input id="price" type="number" step="0.01" min="0" {...register('price', { valueAsNumber: true })} disabled={mutation.isPending} aria-invalid={!!errors.price} />
                {errors.price && <p className="text-sm text-destructive" role="alert">{errors.price.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input id="displayOrder" type="number" min="0" {...register('displayOrder', { valueAsNumber: true })} disabled={mutation.isPending} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <div className="flex gap-2">
                <Input id="imageUrl" {...register('imageUrl')} placeholder="https://..." disabled={mutation.isPending} />
                <Button type="button" variant="outline" onClick={() => document.getElementById('image-upload')?.click()} disabled={mutation.isPending || isUploading}>
                  <Upload className="h-4 w-4 mr-2" />Upload
                </Button>
                <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={mutation.isPending} />
              </div>
              {imagePreview && (
                <div className="relative w-32 h-32">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded border" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isVegetarian" {...register('isVegetarian')} disabled={mutation.isPending} />
              <Label htmlFor="isVegetarian">Vegetarian</Label>
            </div>

            {error && <Alert variant="destructive" className="gap-2"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={isEditing ? closeEditItem : closeCreateItem} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving... </>
                : (isEditing ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}