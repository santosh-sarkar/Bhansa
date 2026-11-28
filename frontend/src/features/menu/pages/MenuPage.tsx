'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { MenuDialogProvider, useMenuDialogs } from '@/features/menu/components/MenuDialogContext'
import { CategoryDialog } from '@/features/menu/components/dialogs/CategoryDialog'
import { MenuItemDialog } from '@/features/menu/components/dialogs/MenuItemDialog'
import { OptionDialog } from '@/features/menu/components/dialogs/OptionDialog'
import { CategoriesTable } from '@/features/menu/components/CategoriesTable'
import { MenuItemsTable } from '@/features/menu/components/MenuItemsTable'
import { OptionsTable } from '@/features/menu/components/OptionsTable'
import { MenuItemOutletOverridesDialog } from '@/features/menu/components/menu-item-outlet-overrides-dialog'
import {
  fetchCategories,
  deleteCategory,
  fetchMenuItems,
  deleteMenuItem,
} from '@/features/menu/services/menu.api'

import { useAuthStore } from '@/store/authStore'

function MenuPageContent() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

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
    // Options
    managingOptionsItem,
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

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] })
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] })
    },
  })

  // Handlers
  const handleDeleteCategory = useCallback((id: string) => {
    deleteCategoryMutation.mutate(id)
  }, [deleteCategoryMutation])

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
      {managingOptionsItem && (
        <OptionsTable
          options={managingOptionsItem.options ?? []}
          isLoading={false}
          menuItem={managingOptionsItem}
          canManage={canManageMenu}
          onEdit={openEditOption}
          onDelete={() => {
            // TODO: implement delete option
          }}
          onCreate={openCreateOption}
        />
      )}
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

export default function MenuPage() {
  return (
    <MenuDialogProvider>
      <MenuPageContent />
    </MenuDialogProvider>
  )
}