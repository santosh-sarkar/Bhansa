'use client'

import { useState, useEffect, useRef } from 'react'
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
  CardDescription,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Plus,
  Search,
  Loader2,
  Truck,
  Package,
  RotateCcw,
  CheckCircle,
  MoreHorizontal,
  Utensils,
  Edit,
  Trash2,
  AlertTriangle,
  Zap,
  Minus,
  ClipboardList,
  History,
  Factory,
} from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import {
  fetchIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  fetchRecipeItems,
  createRecipeItem,
  updateRecipeItem,
  deleteRecipeItem,
  fetchOutletStock,
  bulkUpdateLowThreshold,
  recordRestock,
  recordAdjustment,
  recordWastage,
  fetchStockMovements,
  type Ingredient,
  type RecipeItem,
  type MovementType,
} from '@/features/inventory/services/inventory.api'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const movementTypeColors: Record<MovementType, string> = {
  restock: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  order_deduction: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  order_restore: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  adjustment: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  wastage: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const movementTypeLabels: Record<MovementType, string> = {
  restock: 'Restock',
  order_deduction: 'Order Deduction',
  order_restore: 'Order Restore',
  adjustment: 'Adjustment',
  wastage: 'Wastage',
}

// ===== Schemas =====

const createIngredientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  unit: z.string().min(1, 'Unit is required').max(20),
  defaultCost: z.string().regex(/^\d+(\.\d{1,4})?$/).optional().or(z.literal('')),
  isActive: z.boolean(),
})

type CreateIngredientForm = z.infer<typeof createIngredientSchema> & { isActive: boolean }

const updateIngredientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  unit: z.string().min(1, 'Unit is required').max(20).optional(),
  defaultCost: z.string().regex(/^\d+(\.\d{1,4})?$/).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

type UpdateIngredientForm = z.infer<typeof updateIngredientSchema>

const restockSchema = z.object({
  ingredientId: z.string().uuid('Invalid ingredient ID'),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a valid decimal'),
  unitCost: z.string().regex(/^\d+(\.\d{1,4})?$/).optional().or(z.literal('')),
  supplier: z.string().max(200).optional(),
  reason: z.string().max(500).optional(),
})

type RestockForm = z.infer<typeof restockSchema>

const adjustmentSchema = z.object({
  ingredientId: z.string().uuid('Invalid ingredient ID'),
  quantity: z.string().regex(/^-?\d+(\.\d{1,3})?$/, 'Quantity must be a valid decimal (can be negative)'),
  unitCost: z.string().regex(/^\d+(\.\d{1,4})?$/).optional().or(z.literal('')),
  reason: z.string().min(1, 'Reason is required').max(500),
})

type AdjustmentForm = z.infer<typeof adjustmentSchema>

const wastageSchema = z.object({
  ingredientId: z.string().uuid('Invalid ingredient ID'),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a positive decimal'),
  unitCost: z.string().regex(/^\d+(\.\d{1,4})?$/).optional().or(z.literal('')),
  reason: z.string().min(1, 'Reason is required').max(500),
})

type WastageForm = z.infer<typeof wastageSchema>

const recipeItemSchema = z.object({
  ingredientId: z.string().uuid('Invalid ingredient ID'),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a valid decimal'),
})

type RecipeItemForm = z.infer<typeof recipeItemSchema>

const updateRecipeItemSchema = z.object({
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a valid decimal'),
})

type UpdateRecipeItemForm = z.infer<typeof updateRecipeItemSchema>

// ===== Helper Components =====

function SearchInput({ onChange, placeholder, value }: { onChange: (v: string) => void; placeholder: string; value: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 w-full sm:w-64"
      />
    </div>
  )
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? 'default' : 'secondary'}>
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  )
}

function MovementTypeBadge({ type }: { type: MovementType }) {
  return (
    <Badge variant="secondary" className={movementTypeColors[type]}>
      {movementTypeLabels[type]}
    </Badge>
  )
}

// ===== Ingredients Tab =====

function IngredientsTab() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isActiveFilter, setIsActiveFilter] = useState<'all' | 'true' | 'false'>('all')

  const { data: ingredientsData, isLoading } = useQuery({
    queryKey: ['ingredients', search, page, isActiveFilter],
    queryFn: () => fetchIngredients({
      page,
      limit: 20,
      search: search || undefined,
      isActive: isActiveFilter === 'all' ? undefined : isActiveFilter === 'true',
    }),
  })

  const ingredients = ingredientsData?.data ?? []
  const totalPages = ingredientsData?.meta?.totalPages ?? 1

  // Create mutation
  const createDialogRef = useRef<HTMLDialogElement | null>(null)
  const createForm = useForm<CreateIngredientForm>({
    resolver: zodResolver(createIngredientSchema),
    defaultValues: { name: '', unit: '', defaultCost: '', isActive: true },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateIngredientForm) => createIngredient({
      name: data.name,
      unit: data.unit,
      defaultCost: data.defaultCost || undefined,
      isActive: data.isActive,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      createForm.reset()
      createDialogRef.current?.close()
    },
    onError: (err: Error) => alert(err.message),
  })

  // Update mutation
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const updateForm = useForm<UpdateIngredientForm>({
    resolver: zodResolver(updateIngredientSchema),
    defaultValues: { name: '', unit: '', defaultCost: '', isActive: true },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIngredientForm }) => updateIngredient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      setEditingIngredient(null)
      updateForm.reset()
    },
    onError: (err: Error) => alert(err.message),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteIngredient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
    onError: (err: Error) => alert(err.message),
  })

  const handleCreateSubmit = (data: CreateIngredientForm) => createMutation.mutate(data)
  const handleUpdateSubmit = (data: UpdateIngredientForm) => {
    if (editingIngredient) updateMutation.mutate({ id: editingIngredient.id, data })
  }

  const openCreateDialog = () => {
    createForm.reset()
    createDialogRef.current?.showModal()
  }

  const openEditDialog = (ingredient: Ingredient) => {
    updateForm.reset({
      name: ingredient.name,
      unit: ingredient.unit,
      defaultCost: ingredient.defaultCost ?? '',
      isActive: ingredient.isActive,
    })
    setEditingIngredient(ingredient)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to deactivate this ingredient?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Ingredients</h2>
          {hasPermission('inventory.manage') && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Ingredient
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SearchInput onChange={setSearch} placeholder="Search ingredients..." value={search} />
          <Select value={isActiveFilter} onValueChange={(v: string | null) => setIsActiveFilter((v ?? 'all') as 'all' | 'true' | 'false')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No ingredients found</h3>
              <p className="text-muted-foreground">Create your first ingredient to get started.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Default Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-40">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredients.map((ingredient) => (
                      <TableRow key={ingredient.id}>
                        <TableCell className="font-medium">{ingredient.name}</TableCell>
                        <TableCell>{ingredient.unit}</TableCell>
                        <TableCell>{ingredient.defaultCost ? `₹${ingredient.defaultCost}` : '-'}</TableCell>
                        <TableCell><StatusBadge isActive={ingredient.isActive} /></TableCell>
                        <TableCell>
                          {hasPermission('inventory.manage') && (
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open actions menu" />}>
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(ingredient)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(ingredient.id)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({ingredientsData?.meta.total ?? 0} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createForm.formState.isSubmitting || false} onOpenChange={createForm.formState.isSubmitting ? () => {} : (open) => { if (!open) createForm.reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Ingredient</DialogTitle>
            <DialogDescription>Create a new ingredient for inventory tracking.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" {...createForm.register('name')} placeholder="e.g., Tomato" />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="unit">Unit *</Label>
                <Input id="unit" {...createForm.register('unit')} placeholder="e.g., kg, pcs, L" />
                {createForm.formState.errors.unit && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.unit.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="defaultCost">Default Cost (per unit)</Label>
                <Input id="defaultCost" type="number" step="0.0001" {...createForm.register('defaultCost')} placeholder="0.00" />
              </div>
              <div>
                <Label htmlFor="isActive">Status</Label>
                <Select
                  value={createForm.watch('isActive')?.toString() ?? 'true'}
                  onValueChange={(v: string | null) => createForm.setValue('isActive', (v ?? 'true') === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => createForm.formState.isSubmitting && createForm.reset()}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingIngredient} onOpenChange={(open) => { if (!open) setEditingIngredient(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Ingredient</DialogTitle>
            <DialogDescription>Update ingredient details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={updateForm.handleSubmit(handleUpdateSubmit)} className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input id="edit-name" {...updateForm.register('name')} />
                {updateForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{updateForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-unit">Unit *</Label>
                <Input id="edit-unit" {...updateForm.register('unit')} />
                {updateForm.formState.errors.unit && (
                  <p className="text-sm text-destructive">{updateForm.formState.errors.unit.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-defaultCost">Default Cost (per unit)</Label>
                <Input id="edit-defaultCost" type="number" step="0.0001" {...updateForm.register('defaultCost')} />
              </div>
              <div>
                <Label htmlFor="edit-isActive">Status</Label>
                <Select
                  value={updateForm.watch('isActive')?.toString() ?? 'true'}
                  onValueChange={(v: string | null) => updateForm.setValue('isActive', (v ?? 'true') === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingIngredient(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Recipes Tab =====

function RecipesTab({ outletId }: { outletId: string }) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [menuItemId, setMenuItemId] = useState('')
  const [menuItems, setMenuItems] = useState<Array<{ id: string; name: string }>>([])

  // Fetch menu items for selector
  useEffect(() => {
    if (!outletId) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/menu/effective`, {
      credentials: 'include',
      headers: { 'X-Outlet-Id': outletId },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const items: Array<{ id: string; name: string }> = []
          data.data.categories.forEach((cat: { items: Array<any> }) => {
            cat.items.forEach((item: any) => {
              if (item.isActive) items.push({ id: item.id, name: item.name })
            })
          })
          setMenuItems(items)
        }
      })
      .catch(console.error)
  }, [outletId])

  const { data: recipeData, isLoading } = useQuery({
    queryKey: ['recipe', menuItemId],
    queryFn: () => fetchRecipeItems(menuItemId),
    enabled: !!menuItemId,
  })

  const recipeItems = recipeData ?? []

  // Add mutation
  const addDialogRef = useRef<HTMLDialogElement>(null)
  const addForm = useForm<RecipeItemForm>({
    resolver: zodResolver(recipeItemSchema),
    defaultValues: { ingredientId: '', quantity: '' },
  })

  const addMutation = useMutation({
    mutationFn: (data: RecipeItemForm) => createRecipeItem(menuItemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', menuItemId] })
      addForm.reset()
      addDialogRef.current?.close()
    },
    onError: (err: Error) => alert(err.message),
  })

  // Update mutation
  const [editingRecipeItem, setEditingRecipeItem] = useState<RecipeItem | null>(null)
  const updateForm = useForm<UpdateRecipeItemForm>({
    resolver: zodResolver(updateRecipeItemSchema),
    defaultValues: { quantity: '' },
  })

  const updateMutation = useMutation({
    mutationFn: ({ ingredientId, data }: { ingredientId: string; data: UpdateRecipeItemForm }) => updateRecipeItem(menuItemId, ingredientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', menuItemId] })
      setEditingRecipeItem(null)
      updateForm.reset()
    },
    onError: (err: Error) => alert(err.message),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (ingredientId: string) => deleteRecipeItem(menuItemId, ingredientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipe', menuItemId] }),
    onError: (err: Error) => alert(err.message),
  })

  const handleAddSubmit = (data: RecipeItemForm) => addMutation.mutate(data)
  const handleUpdateSubmit = (data: UpdateRecipeItemForm) => {
    if (editingRecipeItem) updateMutation.mutate({ ingredientId: editingRecipeItem.ingredientId, data })
  }

  const openAddDialog = () => {
    addForm.reset()
    addDialogRef.current?.showModal()
  }

  const openEditDialog = (item: RecipeItem) => {
    updateForm.reset({ quantity: item.quantity })
    setEditingRecipeItem(item)
  }

  const handleDelete = (ingredientId: string) => {
    if (confirm('Remove this ingredient from the recipe?')) {
      deleteMutation.mutate(ingredientId)
    }
  }

  return (
    <div className="space-y-4">
      {/* Menu Item Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Menu Item</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={menuItemId} onValueChange={(v: string | null) => setMenuItemId(v ?? '')}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Choose a menu item..." />
            </SelectTrigger>
            <SelectContent>
              {menuItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {menuItemId && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-bold">Recipe for {menuItems.find(m => m.id === menuItemId)?.name}</h2>
            {hasPermission('menu.edit') && (
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Ingredient
              </Button>
            )}
          </div>

          {/* Recipe Table */}
          <Card>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : recipeItems.length === 0 ? (
                <div className="text-center py-8">
                  <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No recipe items</h3>
                  <p className="text-muted-foreground">Add ingredients to define the recipe for this menu item.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="w-40">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipeItems.map((item) => (
                        <TableRow key={item.ingredientId}>
                          <TableCell className="font-medium">{item.ingredientName}</TableCell>
                          <TableCell>{item.ingredientUnit}</TableCell>
                          <TableCell className="font-mono">{item.quantity} {item.ingredientUnit}</TableCell>
                          <TableCell>
                            {hasPermission('menu.edit') && (
                              <DropdownMenu>
                                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open actions menu" />}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Quantity
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDelete(item.ingredientId)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Dialog */}
          <Dialog open={addForm.formState.isSubmitting || false} onOpenChange={addForm.formState.isSubmitting ? () => {} : (open) => { if (!open) addForm.reset(); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Recipe Ingredient</DialogTitle>
                <DialogDescription>Add an ingredient to this menu item&apos;s recipe.</DialogDescription>
              </DialogHeader>
              <form onSubmit={addForm.handleSubmit(handleAddSubmit)} className="space-y-4 py-4">
                <div>
                  <Label htmlFor="ingredientId">Ingredient *</Label>
                  <Select
                    value={addForm.watch('ingredientId')}
                    onValueChange={(v: string | null) => addForm.setValue('ingredientId', v ?? '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ingredient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Would need to fetch ingredients here - simplified for now */}
                    </SelectContent>
                  </Select>
                  {addForm.formState.errors.ingredientId && (
                    <p className="text-sm text-destructive">{addForm.formState.errors.ingredientId.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input id="quantity" {...addForm.register('quantity')} placeholder="e.g., 0.5" />
                  {addForm.formState.errors.quantity && (
                    <p className="text-sm text-destructive">{addForm.formState.errors.quantity.message}</p>
                  )}
                </div>
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={() => addForm.formState.isSubmitting && addForm.reset()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={!!editingRecipeItem} onOpenChange={(open) => { if (!open) setEditingRecipeItem(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Quantity</DialogTitle>
                <DialogDescription>Update the quantity for {editingRecipeItem?.ingredientName}.</DialogDescription>
              </DialogHeader>
              <form onSubmit={updateForm.handleSubmit(handleUpdateSubmit)} className="space-y-4 py-4">
                <div>
                  <Label htmlFor="edit-quantity">Quantity *</Label>
                  <Input id="edit-quantity" {...updateForm.register('quantity')} />
                  {updateForm.formState.errors.quantity && (
                    <p className="text-sm text-destructive">{updateForm.formState.errors.quantity.message}</p>
                  )}
                </div>
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingRecipeItem(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

// ===== Stock Tab =====

function StockTab({ outletId }: { outletId: string }) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isLowFilter, setIsLowFilter] = useState<'all' | 'true' | 'false'>('all')

  const { data: stockData, isLoading } = useQuery({
    queryKey: ['outletStock', outletId, search, page, isLowFilter],
    queryFn: () => fetchOutletStock(outletId, {
      page,
      limit: 20,
      search: search || undefined,
      isLow: isLowFilter === 'all' ? undefined : isLowFilter === 'true',
    }),
    enabled: !!outletId,
  })

  const stock = stockData?.data ?? []
  const totalPages = stockData?.meta.totalPages ?? 1

  // Bulk update low threshold
  const [bulkEditItems, setBulkEditItems] = useState<Record<string, string>>({})
  const [isBulkEditing, setIsBulkEditing] = useState(false)

  const bulkUpdateMutation = useMutation({
    mutationFn: (items: Array<{ ingredientId: string; lowThreshold: string }>) =>
      bulkUpdateLowThreshold(outletId, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outletStock'] })
      setBulkEditItems({})
      setIsBulkEditing(false)
    },
    onError: (err: Error) => alert(err.message),
  })

  const handleBulkSave = () => {
    const items = Object.entries(bulkEditItems).map(([ingredientId, lowThreshold]) => ({
      ingredientId,
      lowThreshold,
    }))
    if (items.length > 0) {
      bulkUpdateMutation.mutate(items)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Stock Levels
          </h2>
          {isBulkEditing && (
            <Button onClick={handleBulkSave} disabled={bulkUpdateMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save All
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SearchInput onChange={setSearch} placeholder="Search stock..." value={search} />
          <Select value={isLowFilter} onValueChange={(v: string | null) => setIsLowFilter((v ?? 'all') as 'all' | 'true' | 'false')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Low Stock Only</SelectItem>
              <SelectItem value="false">Normal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : stock.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No stock items</h3>
              <p className="text-muted-foreground">Ingredients will appear here when added to this outlet.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Current Qty</TableHead>
                      <TableHead className="text-right">Low Threshold</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock.map((item) => (
                      <TableRow key={item.ingredientId}>
                        <TableCell className="font-medium">{item.ingredientName}</TableCell>
                        <TableCell>{item.ingredientUnit}</TableCell>
                        <TableCell className="text-right font-mono">{Number(item.quantity).toLocaleString()} {item.ingredientUnit}</TableCell>
                        <TableCell className="text-right">
                          {isBulkEditing ? (
                            <Input
                              type="number"
                              step="0.001"
                              value={bulkEditItems[item.ingredientId] || item.lowThreshold || ''}
                              onChange={(e) => setBulkEditItems(prev => ({ ...prev, [item.ingredientId]: e.target.value }))}
                              className="w-24"
                            />
                          ) : (
                            <span className="font-mono">
                              {item.lowThreshold ? Number(item.lowThreshold).toLocaleString() : '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.isLow ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="default">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({stockData?.meta.total ?? 0} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {hasPermission('inventory.manage') && (
                <div className="mt-4 flex gap-2">
                  {isBulkEditing ? (
                    <>
                      <Button variant="outline" onClick={() => { setBulkEditItems({}); setIsBulkEditing(false); }}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setIsBulkEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Thresholds
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Restock Tab =====

function RestockTab({ outletId }: { outletId: string }) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string; unit: string }>>([])

  // Fetch ingredients for selector
  useEffect(() => {
    if (!outletId) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/ingredients?is_active=true&limit=100`, {
      credentials: 'include',
      headers: { 'X-Outlet-Id': outletId },
    })
      .then(res => res.json())
      .then((data: { success: boolean; data?: Array<{ id: string; name: string; unit: string }> }) => {
        if (data.success && data.data) {
          setIngredients(data.data.map((i) => ({ id: i.id, name: i.name, unit: i.unit })))
        }
      })
      .catch(console.error)
  }, [outletId])

  const dialogRef = useRef<HTMLDialogElement>(null)
  const form = useForm<RestockForm>({
    resolver: zodResolver(restockSchema),
    defaultValues: { ingredientId: '', quantity: '', unitCost: '', supplier: '', reason: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: RestockForm) => recordRestock(outletId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outletStock'] })
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      form.reset()
      dialogRef.current?.close()
    },
    onError: (err: Error) => alert(err.message),
  })

  const handleSubmit = (data: RestockForm) => mutation.mutate(data)

  const openDialog = () => {
    form.reset()
    dialogRef.current?.showModal()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Record Restock
        </h2>
        {hasPermission('inventory.restock') && (
          <Button onClick={openDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Restock
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Restock Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="ingredientId">Ingredient *</Label>
              <Select
                value={form.watch('ingredientId')}
                onValueChange={(v: string | null) => form.setValue('ingredientId', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ingredient..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.ingredientId && (
                <p className="text-sm text-destructive">{form.formState.errors.ingredientId.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input id="quantity" {...form.register('quantity')} placeholder="e.g., 50" />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="unitCost">Unit Cost</Label>
                <Input id="unitCost" type="number" step="0.0001" {...form.register('unitCost')} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Input id="supplier" {...form.register('supplier')} placeholder="Supplier name" />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" {...form.register('reason')} placeholder="Reason for restock" />
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={form.formState.isSubmitting || false} onOpenChange={form.formState.isSubmitting ? () => {} : (open) => { if (!open) form.reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Restock</DialogTitle>
            <DialogDescription>Add new stock for an ingredient.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <div>
              <Label htmlFor="dialog-ingredientId">Ingredient *</Label>
              <Select
                value={form.watch('ingredientId')}
                onValueChange={(v: string | null) => form.setValue('ingredientId', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ingredient..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.ingredientId && (
                <p className="text-sm text-destructive">{form.formState.errors.ingredientId.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dialog-quantity">Quantity *</Label>
                <Input id="dialog-quantity" {...form.register('quantity')} placeholder="e.g., 50" />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="dialog-unitCost">Unit Cost</Label>
                <Input id="dialog-unitCost" type="number" step="0.0001" {...form.register('unitCost')} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label htmlFor="dialog-supplier">Supplier</Label>
              <Input id="dialog-supplier" {...form.register('supplier')} placeholder="Supplier name" />
            </div>
            <div>
              <Label htmlFor="dialog-reason">Reason</Label>
              <Input id="dialog-reason" {...form.register('reason')} placeholder="Reason for restock" />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => form.formState.isSubmitting && form.reset()}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Adjustment Tab =====

function AdjustmentTab({ outletId }: { outletId: string }) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string; unit: string }>>([])

  useEffect(() => {
    if (!outletId) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/ingredients?is_active=true&limit=100`, {
      credentials: 'include',
      headers: { 'X-Outlet-Id': outletId },
    })
      .then(res => res.json())
      .then((data: { success: boolean; data?: Array<{ id: string; name: string; unit: string }> }) => {
        if (data.success && data.data) {
          setIngredients(data.data.map((i) => ({ id: i.id, name: i.name, unit: i.unit })))
        }
      })
      .catch(console.error)
  }, [outletId])

  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const form = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { ingredientId: '', quantity: '', unitCost: '', reason: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: AdjustmentForm) => recordAdjustment(outletId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outletStock'] })
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      form.reset()
      dialogRef.current?.close()
    },
    onError: (err: Error) => alert(err.message),
  })

  const handleSubmit = (data: AdjustmentForm) => mutation.mutate(data)
  const openDialog = () => { form.reset(); dialogRef.current?.showModal() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Minus className="h-5 w-5" />
          Record Adjustment
        </h2>
        {hasPermission('inventory.adjust') && (
          <Button onClick={openDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Adjustment
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adjustment Form</CardTitle>
          <CardDescription>Adjust stock quantity (positive or negative). Requires a reason.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="ingredientId">Ingredient *</Label>
              <Select
                value={form.watch('ingredientId')}
                onValueChange={(v: string | null) => form.setValue('ingredientId', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ingredient..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.ingredientId && (
                <p className="text-sm text-destructive">{form.formState.errors.ingredientId.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input id="quantity" {...form.register('quantity')} placeholder="e.g., -5 or +10" />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="unitCost">Unit Cost</Label>
                <Input id="unitCost" type="number" step="0.0001" {...form.register('unitCost')} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Input id="reason" {...form.register('reason')} placeholder="Reason for adjustment" />
              {form.formState.errors.reason && (
                <p className="text-sm text-destructive">{form.formState.errors.reason.message}</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={form.formState.isSubmitting || false} onOpenChange={form.formState.isSubmitting ? () => {} : (open) => { if (!open) form.reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Adjustment</DialogTitle>
            <DialogDescription>Adjust stock quantity (positive or negative). Requires a reason.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <div>
              <Label htmlFor="dialog-ingredientId">Ingredient *</Label>
              <Select
                value={form.watch('ingredientId')}
                onValueChange={(v: string | null) => form.setValue('ingredientId', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ingredient..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.ingredientId && (
                <p className="text-sm text-destructive">{form.formState.errors.ingredientId.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dialog-quantity">Quantity *</Label>
                <Input id="dialog-quantity" {...form.register('quantity')} placeholder="e.g., -5 or +10" />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="dialog-unitCost">Unit Cost</Label>
                <Input id="dialog-unitCost" type="number" step="0.0001" {...form.register('unitCost')} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label htmlFor="dialog-reason">Reason *</Label>
              <Input id="dialog-reason" {...form.register('reason')} placeholder="Reason for adjustment" />
              {form.formState.errors.reason && (
                <p className="text-sm text-destructive">{form.formState.errors.reason.message}</p>
              )}
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => form.formState.isSubmitting && form.reset()}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Minus className="h-4 w-4 mr-2" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Wastage Tab =====

function WastageTab({ outletId }: { outletId: string }) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string; unit: string }>>([])

  useEffect(() => {
    if (!outletId) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/ingredients?is_active=true&limit=100`, {
      credentials: 'include',
      headers: { 'X-Outlet-Id': outletId },
    })
      .then(res => res.json())
      .then((data: { success: boolean; data?: Array<{ id: string; name: string; unit: string }> }) => {
        if (data.success && data.data) {
          setIngredients(data.data.map((i) => ({ id: i.id, name: i.name, unit: i.unit })))
        }
      })
      .catch(console.error)
  }, [outletId])

  const dialogRef = useRef<HTMLDialogElement>(null)
  const form = useForm<WastageForm>({
    resolver: zodResolver(wastageSchema),
    defaultValues: { ingredientId: '', quantity: '', unitCost: '', reason: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: WastageForm) => recordWastage(outletId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outletStock'] })
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      form.reset()
      dialogRef.current?.close()
    },
    onError: (err: Error) => alert(err.message),
  })

  const handleSubmit = (data: WastageForm) => mutation.mutate(data)
  const openDialog = () => { form.reset(); dialogRef.current?.showModal() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Record Wastage
        </h2>
        {hasPermission('inventory.wastage') && (
          <Button onClick={openDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Wastage
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wastage Form</CardTitle>
          <CardDescription>Record stock wastage (positive quantity only). Requires a reason.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="ingredientId">Ingredient *</Label>
              <Select
                value={form.watch('ingredientId')}
                onValueChange={(v: string | null) => form.setValue('ingredientId', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ingredient..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.ingredientId && (
                <p className="text-sm text-destructive">{form.formState.errors.ingredientId.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input id="quantity" {...form.register('quantity')} placeholder="e.g., 5" />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="unitCost">Unit Cost</Label>
                <Input id="unitCost" type="number" step="0.0001" {...form.register('unitCost')} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Input id="reason" {...form.register('reason')} placeholder="Reason for wastage" />
              {form.formState.errors.reason && (
                <p className="text-sm text-destructive">{form.formState.errors.reason.message}</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={form.formState.isSubmitting || false} onOpenChange={form.formState.isSubmitting ? () => {} : (open) => { if (!open) form.reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Wastage</DialogTitle>
            <DialogDescription>Record stock wastage (positive quantity only). Requires a reason.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <div>
              <Label htmlFor="dialog-ingredientId">Ingredient *</Label>
              <Select
                value={form.watch('ingredientId')}
                onValueChange={(v: string | null) => form.setValue('ingredientId', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ingredient..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.ingredientId && (
                <p className="text-sm text-destructive">{form.formState.errors.ingredientId.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dialog-quantity">Quantity *</Label>
                <Input id="dialog-quantity" {...form.register('quantity')} placeholder="e.g., 5" />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="dialog-unitCost">Unit Cost</Label>
                <Input id="dialog-unitCost" type="number" step="0.0001" {...form.register('unitCost')} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label htmlFor="dialog-reason">Reason *</Label>
              <Input id="dialog-reason" {...form.register('reason')} placeholder="Reason for wastage" />
              {form.formState.errors.reason && (
                <p className="text-sm text-destructive">{form.formState.errors.reason.message}</p>
              )}
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => form.formState.isSubmitting && form.reset()}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Movements Tab =====

function MovementsTab({ outletId }: { outletId: string }) {
  const [page, setPage] = useState(1)
  const [ingredientId, setIngredientId] = useState('')
  const [typeFilter, setTypeFilter] = useState<MovementType | 'all'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['movements', outletId, page, ingredientId, typeFilter, startDate, endDate],
    queryFn: () => fetchStockMovements(outletId, {
      page,
      limit: 20,
      ingredientId: ingredientId || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    enabled: !!outletId,
  })

  const movements = movementsData?.data ?? []
  const totalPages = movementsData?.meta.totalPages ?? 1

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <History className="h-5 w-5" />
        Stock Movements
      </h2>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="ingredientId">Ingredient</Label>
              <Select value={ingredientId} onValueChange={(v: string | null) => setIngredientId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All ingredients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All ingredients</SelectItem>
                  {/* Would need ingredient list */}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="typeFilter">Type</Label>
              <Select value={typeFilter} onValueChange={(v: string | null) => setTypeFilter((v ?? 'all') as MovementType | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="restock">Restock</SelectItem>
                  <SelectItem value="order_deduction">Order Deduction</SelectItem>
                  <SelectItem value="order_restore">Order Restore</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="wastage">Wastage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="startDate">From</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="endDate">To</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => { setIngredientId(''); setTypeFilter('all'); setStartDate(''); setEndDate(''); }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No movements found</h3>
              <p className="text-muted-foreground">Stock movements will appear here.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Supplier / Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap">{new Date(movement.createdAt).toLocaleString()}</TableCell>
                        <TableCell><MovementTypeBadge type={movement.type} /></TableCell>
                        <TableCell className="font-medium">{movement.ingredientName}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          <span className={movement.type === 'wastage' || (movement.type === 'adjustment' && movement.quantityDelta.startsWith('-')) ? 'text-destructive' : 'text-green-600'}>
                            {movement.type === 'wastage' ? '-' : ''}{movement.quantityDelta} {movement.ingredientUnit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{Number(movement.balanceAfter).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-sm">{movement.unitCost ? `₹${movement.unitCost}` : '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {movement.supplier || movement.reason || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({movementsData?.meta.total ?? 0} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Main Page =====

export default function InventoryPage() {
  const { getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  if (!outletId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Select an outlet to view inventory.</p>
        </div>
        <Alert>
          <AlertDescription>No outlet selected. Please select an outlet from the header.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">Manage ingredients, recipes, stock, and movements.</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ingredients" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="restock">Restock</TabsTrigger>
          <TabsTrigger value="adjust">Adjust</TabsTrigger>
          <TabsTrigger value="wastage">Wastage</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients">
          <IngredientsTab />
        </TabsContent>

        <TabsContent value="recipes">
          <RecipesTab outletId={outletId} />
        </TabsContent>

        <TabsContent value="stock">
          <StockTab outletId={outletId} />
        </TabsContent>

        <TabsContent value="restock">
          <RestockTab outletId={outletId} />
        </TabsContent>

        <TabsContent value="adjust">
          <AdjustmentTab outletId={outletId} />
        </TabsContent>

        <TabsContent value="wastage">
          <WastageTab outletId={outletId} />
        </TabsContent>

        <TabsContent value="movements">
          <MovementsTab outletId={outletId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}