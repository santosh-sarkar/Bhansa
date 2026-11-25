'use client'

import { createContext, useContext, useState, useCallback, ReactNode, ReactElement } from 'react'
import type { Category, MenuItem, MenuItemOption, MenuItemOutletOverride } from '@/features/menu/services/menu.api'

interface MenuDialogState {
  // Category dialogs
  editingCategory: Category | null
  creatingCategory: boolean
  // Menu item dialogs
  editingItem: MenuItem | null
  creatingItem: boolean
  // Options dialogs
  managingOptionsItem: MenuItem | null
  editingOption: { option: MenuItemOption; menuItemId: string } | null
  creatingOptionItemId: string | null
  // Overrides dialog
  managingOverridesItem: MenuItem | null
}

interface MenuDialogActions {
  // Category
  openCreateCategory: () => void
  closeCreateCategory: () => void
  openEditCategory: (category: Category) => void
  closeEditCategory: () => void
  // Menu Item
  openCreateItem: () => void
  closeCreateItem: () => void
  openEditItem: (item: MenuItem) => void
  closeEditItem: () => void
  // Options
  openManageOptions: (item: MenuItem) => void
  closeManageOptions: () => void
  openEditOption: (option: MenuItemOption, menuItemId: string) => void
  closeEditOption: () => void
  openCreateOption: (menuItemId: string) => void
  closeCreateOption: () => void
  // Overrides
  openManageOverrides: (item: MenuItem) => void
  closeManageOverrides: () => void
}

type MenuDialogContextValue = MenuDialogState & MenuDialogActions

const MenuDialogContext = createContext<MenuDialogContextValue | null>(null)

export function MenuDialogProvider({ children }: { children: ReactNode }) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [creatingItem, setCreatingItem] = useState(false)
  const [managingOptionsItem, setManagingOptionsItem] = useState<MenuItem | null>(null)
  const [editingOption, setEditingOption] = useState<{ option: MenuItemOption; menuItemId: string } | null>(null)
  const [creatingOptionItemId, setCreatingOptionItemId] = useState<string | null>(null)
  const [managingOverridesItem, setManagingOverridesItem] = useState<MenuItem | null>(null)

  // Category actions
  const openCreateCategory = useCallback(() => setCreatingCategory(true), [])
  const closeCreateCategory = useCallback(() => setCreatingCategory(false), [])
  const openEditCategory = useCallback((category: Category) => setEditingCategory(category), [])
  const closeEditCategory = useCallback(() => setEditingCategory(null), [])

  // Menu Item actions
  const openCreateItem = useCallback(() => setCreatingItem(true), [])
  const closeCreateItem = useCallback(() => setCreatingItem(false), [])
  const openEditItem = useCallback((item: MenuItem) => setEditingItem(item), [])
  const closeEditItem = useCallback(() => setEditingItem(null), [])

  // Options actions
  const openManageOptions = useCallback((item: MenuItem) => setManagingOptionsItem(item), [])
  const closeManageOptions = useCallback(() => setManagingOptionsItem(null), [])
  const openEditOption = useCallback((option: MenuItemOption, menuItemId: string) => 
    setEditingOption({ option, menuItemId }), [])
  const closeEditOption = useCallback(() => setEditingOption(null), [])
  const openCreateOption = useCallback((menuItemId: string) => setCreatingOptionItemId(menuItemId), [])
  const closeCreateOption = useCallback(() => setCreatingOptionItemId(null), [])

  // Overrides actions
  const openManageOverrides = useCallback((item: MenuItem) => setManagingOverridesItem(item), [])
  const closeManageOverrides = useCallback(() => setManagingOverridesItem(null), [])

  const value: MenuDialogContextValue = {
    // State
    editingCategory,
    creatingCategory,
    editingItem,
    creatingItem,
    managingOptionsItem,
    editingOption,
    creatingOptionItemId,
    managingOverridesItem,
    // Actions
    openCreateCategory,
    closeCreateCategory,
    openEditCategory,
    closeEditCategory,
    openCreateItem,
    closeCreateItem,
    openEditItem,
    closeEditItem,
    openManageOptions,
    closeManageOptions,
    openEditOption,
    closeEditOption,
    openCreateOption,
    closeCreateOption,
    openManageOverrides,
    closeManageOverrides,
  }

  return (
    <MenuDialogContext.Provider value={value}>
      {children}
    </MenuDialogContext.Provider>
  )
}

export function useMenuDialogs() {
  const context = useContext(MenuDialogContext)
  if (!context) {
    throw new Error('useMenuDialogs must be used within a MenuDialogProvider')
  }
  return context
}