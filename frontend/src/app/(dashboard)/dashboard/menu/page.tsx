'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { useMenuDialogs } from '@/features/menu/components/MenuDialogContext'
import { CategoryDialog } from '@/features/menu/components/dialogs/CategoryDialog'
import { MenuItemDialog } from '@/features/menu/components/dialogs/MenuItemDialog'
import { OptionDialog } from '@/features/menu/components/dialogs/OptionDialog'
import { CategoriesTable } from '@/features/menu/components/CategoriesTable'
import { MenuItemsTable } from '@/features/menu/components/MenuItemsTable'
import { OptionsTable } from '@/features/menu/components/OptionsTable'
import { MenuItemOutletOverridesDialog } from '@/features/menu/components/menu-item-outlet-overrides-dialog'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  type Category,
  type MenuItem,
} from '@/features/menu/services/menu.api'
import { routes } from '@/config/routes'
import { useAuthStore } from '@/store/authStore'

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

  const canManageMenu = hasPermission('menu.edit')
  const categories = categoriesData?.data ?? []
  const items = itemsData?.data ?? []

  // Dialog state from context
  const {
    // Category
    creatingCategory,
    closeCreateCategory,
    editingCategory,
    closeEditCategory,
    // Menu Item
    creatingItem,
    closeCreateItem,
    editingItem,
    closeEditItem,
    // Options
    managingOptionsItem,
    closeManageOptions,
    editingOption,
    closeEditOption,
    creatingOptionItemId,
    closeCreateOption,
    // Overrides
    managingOverridesItem,
    closeManageOverrides,
    // Actions
    openCreateCategory,
    openEditCategory,
    openCreateItem,
    openEditItem,
    openManageOptions,
    openEditOption,
    openCreateOption,
    openManageOverrides,
  } = useMenuDialogs()

  // Mutations for categories
  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] })
      closeCreateCategory()
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCategory>[1] }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] })
      closeEditCategory()
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] })
    },
  })

  // Mutations for menu items
  const createItemMutation = useMutation({
    mutationFn: createMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] })
      closeCreateItem()
    },
  })

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateMenuItem>[1] }) => updateMenuItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] })
      closeEditItem()
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] })
    },
  })

  // Handlers
  const handleCreateCategory = useCallback((data: Parameters<typeof createCategory>[0]) => {
    createCategoryMutation.mutate(data)
  }, [createCategoryMutation])

  const handleEditCategory = useCallback((id: string, data: Parameters<typeof updateCategory>[1]) => {
    updateCategoryMutation.mutate({ id, data })
  }, [updateCategoryMutation])

  const handleDeleteCategory = useCallback((id: string) => {
    deleteCategoryMutation.mutate(id)
  }, [deleteCategoryMutation])

  const handleCreateItem = useCallback((data: Parameters<typeof createMenuItem>[0]) => {
    createItemMutation.mutate(data)
  }, [createItemMutation])

  const handleEditItem = useCallback((id: string, data: Parameters<typeof updateMenuItem>[1]) => {
    updateItemMutation.mutate({ id, data })
  }, [updateItemMutation])

  const handleDeleteItem = useCallback((id: string) => {
    deleteItemMutation.mutate(id)
  }, [deleteItemMutation])

  const handleReorderCategory = useCallback((id: string, direction: 'up' | 'down') => {
    // TODO: implement reorder API
    console.log('Reorder category:', id, direction)
  }, [])

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
              <Button onClick={openCreateCategory}>
                <Plus className="h-4 w-4 mr-2" />
                Category
              </Button>
              <Button onClick={openCreateItem}>
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
            <Button variant="outline" size="sm" onClick={openCreateCategory}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <CategoriesTable
            categories={categories}
            isLoading={categoriesLoading}
            onReorder={canManageMenu ? handleReorderCategory : undefined}
            canManage={canManageMenu}
            onEdit={openEditCategory}
            onDelete={handleDeleteCategory}
            onCreate={openCreateCategory}
          />
        </CardContent>
      </Card>

      {/* Menu Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Menu Items</CardTitle>
          {canManageMenu && (
            <Button onClick={openCreateItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Menu Item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <MenuItemsTable
            items={items}
            isLoading={itemsLoading}
            canManage={canManageMenu}
            onEdit={openEditItem}
            onDelete={handleDeleteItem}
            onManageOptions={openManageOptions}
            onManageOverrides={openManageOverrides}
            onCreate={openCreateItem}
          />
        </CardContent>
      </Card>

      {/* Dialogs - rendered via context */}
      <CategoryDialog categories={categories} />
      <MenuItemDialog categories={categories} />
      <OptionsTable
        options={managingOptionsItem?.options ?? []}
        isLoading={false}
        menuItem={managingOptionsItem!}
        canManage={canManageMenu}
        onEdit={openEditOption}
        onDelete={(id) => {
          // TODO: implement delete option
        }}
        onCreate={openCreateOption}
      />
      <OptionDialog />
      <MenuItemOutletOverridesDialog
        menuItemId={managingOverridesItem?.id ?? ''}
        menuItemName={managingOverridesItem?.name ?? ''}
        open={!!managingOverridesItem}
        onOpenChange={closeManageOverrides}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['menu', 'items'] })}
      />
    </div>
  )
}