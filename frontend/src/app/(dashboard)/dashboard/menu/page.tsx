'use client'

import { useState, useEffect } from 'react'
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
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
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
import { Plus, Edit, Trash2, MoreHorizontal, Loader2, Search, ChevronUp, ChevronDown, GripVertical, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  uploadMenuImage,
  fetchMenuItemOptions,
  createMenuItemOption,
  updateMenuItemOption,
  deleteMenuItemOption,
  fetchOutletOverrides,
  updateOutletOverrides,
  toggleAvailability,
  type Category,
  type MenuItem,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateMenuItemInput,
  type UpdateMenuItemInput,
  type MenuItemOption,
  type CreateOptionInput,
  type UpdateOptionInput,
  type MenuItemOutletOverride,
} from '@/features/menu/services/menu.api'
import { routes } from '@/config/routes'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  displayOrder: z.number().min(0).optional(),
})

type CategoryForm = z.infer<typeof categorySchema>

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

const optionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  kind: z.enum(['variant', 'addon']),
  priceDelta: z.number(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().min(0).optional(),
})

type OptionForm = z.infer<typeof optionSchema>

const overrideSchema = z.object({
  outletId: z.string().min(1, 'Outlet is required'),
  priceOverride: z.number().nullable().optional(),
  isAvailable: z.boolean().nullable().optional(),
  autoUnavailable: z.boolean().nullable().optional(),
  displayOrder: z.number().min(0).optional(),
})

type OverrideForm = z.infer<typeof overrideSchema>

// ===== Helper Components =====

function CategoriesTable({ categories, isLoading, onReorder }: { categories: Category[]; isLoading: boolean; onReorder?: (id: string, direction: 'up' | 'down') => void }) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Order</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No categories yet. Create your first category.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">Order</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category, index) => (
          <TableRow key={category.id}>
            <TableCell className="font-mono text-sm">{category.displayOrder}</TableCell>
            <TableCell className="font-medium">{category.name}</TableCell>
            <TableCell className="text-muted-foreground max-w-[300px] truncate">{category.description ?? '—'}</TableCell>
            <TableCell>
              <Badge variant={category.isActive ? 'default' : 'secondary'}>
                {category.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('edit-category', { detail: category }))}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  {onReorder && (
                    <>
                      <DropdownMenuItem 
                        onSelect={() => onReorder(category.id, 'up')} 
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Move Up
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onSelect={() => onReorder(category.id, 'down')} 
                        disabled={index === categories.length - 1}
                      >
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Move Down
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (confirm(`Delete category "${category.name}"?`)) {
                        window.dispatchEvent(new CustomEvent('delete-category', { detail: category.id }))
                      }
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
  )
}

function MenuItemsTable({ items, isLoading }: { items: MenuItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Veg</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No menu items yet. Create your first item.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead>Veg</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>{item.categoryName}</TableCell>
            <TableCell className="text-right font-mono">Rs {item.price.toFixed(2)}</TableCell>
            <TableCell>
              {item.isVegetarian && <Badge variant="secondary" className="bg-green-100 text-green-800">Veg</Badge>}
            </TableCell>
            <TableCell>
              <Badge variant={item.isActive ? 'default' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('edit-menu-item', { detail: item }))}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('manage-options', { detail: item }))}>
                    <GripVertical className="h-4 w-4 mr-2" />
                    Manage Options
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('manage-overrides', { detail: item }))}>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Outlet Overrides
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (confirm(`Delete "${item.name}"?`)) {
                        window.dispatchEvent(new CustomEvent('delete-menu-item', { detail: item.id }))
                      }
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
  )
}

function OptionsTable({ options, isLoading, menuItemId }: { options: MenuItemOption[]; isLoading: boolean; menuItemId: string }) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Price Delta</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(3)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (options.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No options yet. Add variants or addons.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Price Delta</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {options.map((opt) => (
          <TableRow key={opt.id}>
            <TableCell className="font-medium">{opt.name}</TableCell>
            <TableCell>
              <Badge variant="secondary" className={opt.kind === 'variant' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                {opt.kind.charAt(0).toUpperCase() + opt.kind.slice(1)}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono">
              {opt.priceDelta >= 0 ? '+' : ''}Rs {opt.priceDelta.toFixed(2)}
            </TableCell>
            <TableCell>
              <Badge variant={opt.isActive ? 'default' : 'secondary'}>
                {opt.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('edit-option', { detail: { option: opt, menuItemId } }))}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (confirm(`Delete option "${opt.name}"?`)) {
                        window.dispatchEvent(new CustomEvent('delete-option', { detail: opt.id }))
                      }
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
  )
}

function OverridesTable({ overrides, isLoading, menuItemId, outlets }: { overrides: MenuItemOutletOverride[]; isLoading: boolean; menuItemId: string; outlets: { id: string; name: string }[] }) {
  if (overrides.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No outlet overrides. Prices and availability use defaults.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Outlet</TableHead>
          <TableHead className="text-right">Price Override</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Auto Unavailable</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {overrides.map((ovr) => {
          const outlet = outlets.find(o => o.id === ovr.outletId)
          return (
            <TableRow key={ovr.id}>
              <TableCell>{outlet?.name ?? ovr.outletId}</TableCell>
              <TableCell className="text-right font-mono">
                {ovr.priceOverride !== null ? `Rs ${ovr.priceOverride.toFixed(2)}` : '— (default)'}
              </TableCell>
              <TableCell>
                {ovr.isAvailable === null ? (
                  <Badge variant="secondary">Default</Badge>
                ) : (
                  <Badge variant={ovr.isAvailable ? 'default' : 'secondary'}>
                    {ovr.isAvailable ? 'Yes' : 'No'}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {ovr.autoUnavailable === null ? (
                  <Badge variant="secondary">Default</Badge>
                ) : (
                  <Badge variant={ovr.autoUnavailable ? 'default' : 'secondary'}>
                    {ovr.autoUnavailable ? 'On' : 'Off'}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// ===== Dialog Components =====

function CategoryDialog({ category, onSuccess, onClose }: { category?: Category; onSuccess: () => void; onClose: () => void }) {
  const isEditing = !!category
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: CategoryForm) => isEditing ? updateCategory(category!.id, data) : createCategory(data),
    onSuccess: () => {
      setError(null)
      onSuccess()
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      displayOrder: category?.displayOrder ?? 0,
    },
  })

  const onSubmit = (data: CategoryForm) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
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
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
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

function MenuItemDialog({ item, categories, onSuccess, onClose }: { item?: MenuItem; categories: Category[]; onSuccess: () => void; onClose: () => void }) {
  const isEditing = !!item
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(item?.imageUrl ?? null)
  const [isUploading, setIsUploading] = useState(false)

  const mutation = useMutation({
    mutationFn: (data: MenuItemForm) => isEditing ? updateMenuItem(item!.id, data) : createMenuItem(data),
    onSuccess: () => {
      setError(null)
      onSuccess()
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<MenuItemForm>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      categoryId: item?.categoryId ?? categories[0]?.id ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item?.price ?? 0,
      imageUrl: item?.imageUrl ?? '',
      isVegetarian: item?.isVegetarian ?? false,
      displayOrder: item?.displayOrder ?? 0,
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

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Menu Item' : 'Create Menu Item'}</DialogTitle>
          <DialogDescription>{isEditing ? 'Update menu item details.' : 'Add a new menu item.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select value={categoryIdValue} onValueChange={(v) => setValue('categoryId', v ?? '')} disabled={mutation.isPending}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
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

function OptionDialog({ option, menuItemId, onSuccess, onClose }: { option?: MenuItemOption; menuItemId: string; onSuccess: () => void; onClose: () => void }) {
  const isEditing = !!option
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: OptionForm) => isEditing ? updateMenuItemOption(option!.id, data) : createMenuItemOption(menuItemId, data),
    onSuccess: () => { setError(null); onSuccess(); onClose() },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<OptionForm>({
    resolver: zodResolver(optionSchema),
    defaultValues: {
      name: option?.name ?? '',
      kind: option?.kind ?? 'variant',
      priceDelta: option?.priceDelta ?? 0,
      isActive: option?.isActive ?? true,
      displayOrder: option?.displayOrder ?? 0,
    },
  })

  const kindValue = watch('kind') ?? 'variant'

  const onSubmit = (data: OptionForm) => mutation.mutate(data)

  return (
    <Dialog open={true} onOpenChange={onClose}>
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
              <Select value={kindValue} onValueChange={(v) => setValue('kind', v as 'variant' | 'addon')} disabled={mutation.isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="variant">Variant</SelectItem>
                  <SelectItem value="addon">Addon</SelectItem>
                </SelectContent>
              </Select>
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
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : (isEditing ? 'Update' : 'Add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OverrideDialog({ override, menuItemId, outlets, onSuccess, onClose }: { override?: MenuItemOutletOverride; menuItemId: string; outlets: { id: string; name: string }[]; onSuccess: () => void; onClose: () => void }) {
  const isEditing = !!override
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (data: OverrideForm) => {
      const result = await updateOutletOverrides(menuItemId, { overrides: [data] })
      return result[0]
    },
    onSuccess: () => { setError(null); onSuccess(); onClose() },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      outletId: override?.outletId ?? outlets[0]?.id ?? '',
      priceOverride: override?.priceOverride ?? null,
      isAvailable: override?.isAvailable ?? null,
      autoUnavailable: override?.autoUnavailable ?? null,
      displayOrder: override?.displayOrder ?? 0,
    },
  })

  const onSubmit = (data: OverrideForm) => mutation.mutate(data)

  const outletIdValue = watch('outletId') ?? ''
  const isAvailableValue = watch('isAvailable')
  const autoUnavailableValue = watch('autoUnavailable')

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Override' : 'Add Outlet Override'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="outletId">Outlet</Label>
              <Select value={outletIdValue} onValueChange={(v) => setValue('outletId', v ?? '')} disabled={mutation.isPending || isEditing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceOverride">Price Override (Rs)</Label>
                <Input id="priceOverride" type="number" step="0.01" min="0" placeholder="Default" {...register('priceOverride', { valueAsNumber: true })} disabled={mutation.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input id="displayOrder" type="number" min="0" {...register('displayOrder', { valueAsNumber: true })} disabled={mutation.isPending} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Available</Label>
                <Select value={isAvailableValue === true ? 'true' : isAvailableValue === false ? 'false' : 'null'} onValueChange={(v) => setValue('isAvailable', v === 'null' ? null : v === 'true' ? true : false)} disabled={mutation.isPending}>
                  <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Default</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auto Unavailable</Label>
                <Select value={autoUnavailableValue === true ? 'true' : autoUnavailableValue === false ? 'false' : 'null'} onValueChange={(v) => setValue('autoUnavailable', v === 'null' ? null : v === 'true' ? true : false)} disabled={mutation.isPending}>
                  <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Default</SelectItem>
                    <SelectItem value="true">On</SelectItem>
                    <SelectItem value="false">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <Alert variant="destructive" className="gap-2"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : (isEditing ? 'Update' : 'Add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ===== Main Page Component =====

export default function MenuPage() {
  const queryClient = useQueryClient()
  const { hasPermission, getAccessibleOutletIds } = useAuthStore()

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['menu', 'categories'],
    queryFn: () => fetchCategories({ limit: 100 }),
  })

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['menu', 'items'],
    queryFn: () => fetchMenuItems({ limit: 100 }),
  })

  const { data: outletsData } = useQuery({
    queryKey: ['outlets', 'list'],
    queryFn: () => import('@/features/outlet/services/outlet.api').then(m => m.fetchOutlets({ limit: 100 })),
  })

  const canManageMenu = hasPermission('menu.edit')
  const categories = categoriesData?.data ?? []
  const items = itemsData?.data ?? []
  const outlets = outletsData?.data ?? []

  // State for dialogs
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [creatingItem, setCreatingItem] = useState(false)
  const [managingOptionsItem, setManagingOptionsItem] = useState<MenuItem | null>(null)
  const [editingOption, setEditingOption] = useState<{ option: MenuItemOption; menuItemId: string } | null>(null)
  const [creatingOptionItemId, setCreatingOptionItemId] = useState<string | null>(null)
  const [managingOverridesItem, setManagingOverridesItem] = useState<MenuItem | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground">Categories, items, options, and outlet overrides.</p>
        </div>
        <div className="flex gap-2">
          {canManageMenu && (
            <>
              <Button onClick={() => setCreatingCategory(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Category
              </Button>
              <Button onClick={() => setCreatingItem(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Menu Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Categories</CardTitle>
          {canManageMenu && (
            <Button variant="outline" size="sm" onClick={() => setCreatingCategory(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <CategoriesTable
            categories={categories}
            isLoading={categoriesLoading}
            onReorder={canManageMenu ? (id, dir) => {
              // TODO: implement reorder API
            } : undefined}
          />
        </CardContent>
      </Card>

      {/* Menu Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Menu Items</CardTitle>
          {canManageMenu && (
            <Button onClick={() => setCreatingItem(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Menu Item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <MenuItemsTable items={items} isLoading={itemsLoading} />
        </CardContent>
      </Card>

      {/* Dialogs */}
      {creatingCategory && (
        <CategoryDialog onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] }); setCreatingCategory(false) }} onClose={() => setCreatingCategory(false)} />
      )}
      {editingCategory && (
        <CategoryDialog category={editingCategory} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] }); setEditingCategory(null) }} onClose={() => setEditingCategory(null)} />
      )}
      {creatingItem && (
        <MenuItemDialog categories={categories} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['menu', 'items'] }); setCreatingItem(false) }} onClose={() => setCreatingItem(false)} />
      )}
      {editingItem && (
        <MenuItemDialog item={editingItem} categories={categories} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['menu', 'items'] }); setEditingItem(null) }} onClose={() => setEditingItem(null)} />
      )}
      {managingOptionsItem && (
        <div>
          <h2 className="text-xl font-bold mb-4">Options for {managingOptionsItem.name}</h2>
          <OptionsTable
            options={managingOptionsItem.options}
            isLoading={false}
            menuItemId={managingOptionsItem.id}
          />
          <Button className="mt-4" onClick={() => setCreatingOptionItemId(managingOptionsItem.id)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </div>
      )}
      {editingOption && (
        <OptionDialog option={editingOption.option} menuItemId={editingOption.menuItemId} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['menu', 'items'] }); setEditingOption(null) }} onClose={() => setEditingOption(null)} />
      )}
      {creatingOptionItemId && (
        <OptionDialog menuItemId={creatingOptionItemId} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['menu', 'items'] }); setCreatingOptionItemId(null) }} onClose={() => setCreatingOptionItemId(null)} />
      )}
      {managingOverridesItem && (
        <div>
          <h2 className="text-xl font-bold mb-4">Outlet Overrides for {managingOverridesItem.name}</h2>
          <OverridesTable
            overrides={managingOverridesItem.outletOverrides}
            isLoading={false}
            menuItemId={managingOverridesItem.id}
            outlets={outlets}
          />
          <Button className="mt-4" onClick={() => alert('Override management coming soon')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Override
          </Button>
        </div>
      )}

      {/* Event listeners for table actions */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('edit-category', (e) => { window.__editCategory = e.detail; });
            window.addEventListener('delete-category', (e) => { window.__deleteCategory = e.detail; });
            window.addEventListener('edit-menu-item', (e) => { window.__editMenuItem = e.detail; });
            window.addEventListener('delete-menu-item', (e) => { window.__deleteMenuItem = e.detail; });
            window.addEventListener('manage-options', (e) => { window.__manageOptions = e.detail; });
            window.addEventListener('manage-overrides', (e) => { window.__manageOverrides = e.detail; });
            window.addEventListener('edit-option', (e) => { window.__editOption = e.detail; });
            window.addEventListener('delete-option', (e) => { window.__deleteOption = e.detail; });
          `
        }}
      />
    </div>
  )
}