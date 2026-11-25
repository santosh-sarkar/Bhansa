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
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMenuDialogs } from '../MenuDialogContext'
import { createCategory, updateCategory, type Category, type CreateCategoryInput, type UpdateCategoryInput } from '@/features/menu/services/menu.api'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  displayOrder: z.number().min(0).optional(),
})

type CategoryForm = z.infer<typeof categorySchema>

interface CategoryDialogProps {
  categories: Category[]
}

export function CategoryDialog({ categories }: CategoryDialogProps) {
  const { editingCategory, creatingCategory, closeEditCategory, closeCreateCategory } = useMenuDialogs()
  const queryClient = useQueryClient()
  
  const isEditing = !!editingCategory
  const isOpen = isEditing || creatingCategory
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: CategoryForm) => 
      isEditing ? updateCategory(editingCategory!.id, data) : createCategory(data),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] })
      if (isEditing) closeEditCategory()
      else closeCreateCategory()
    },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: editingCategory?.name ?? '',
      description: editingCategory?.description ?? '',
      displayOrder: editingCategory?.displayOrder ?? 0,
    },
  })

  const onSubmit = (data: CategoryForm) => {
    mutation.mutate(data)
  }

  if (!isOpen) return null

  return (
    <Dialog open={true} onOpenChange={isEditing ? closeEditCategory : closeCreateCategory}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Category' : 'Create Category'}</DialogTitle>
          <DialogDescription>{isEditing ? 'Update category details.' : 'Add a new menu category.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} disabled={mutation.isPending} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-sm text-destructive" role="alert">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register('description')} placeholder="Optional" disabled={mutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input id="displayOrder" type="number" min="0" {...register('displayOrder', { valueAsNumber: true })} disabled={mutation.isPending} />
            </div>
            {error && <Alert variant="destructive" className="gap-2"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={isEditing ? closeEditCategory : closeCreateCategory} disabled={mutation.isPending}>Cancel</Button>
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