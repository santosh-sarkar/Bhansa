import { api } from '@/lib/apiClient'

export interface Category {
  id: string
  name: string
  description: string | null
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoryListResponse {
  data: Category[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CreateCategoryInput {
  name: string
  description?: string
  displayOrder?: number
}

export interface UpdateCategoryInput {
  name?: string
  description?: string
  displayOrder?: number
  isActive?: boolean
}

export interface MenuItem {
  id: string
  categoryId: string
  categoryName: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  isVegetarian: boolean
  isActive: boolean
  displayOrder: number
  options: MenuItemOption[]
  outletOverrides: MenuItemOutletOverride[]
  createdAt: string
  updatedAt: string
}

export interface MenuItemListResponse {
  data: MenuItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface MenuItemOption {
  id: string
  menuItemId: string
  name: string
  kind: 'variant' | 'addon'
  priceDelta: number
  isActive: boolean
  displayOrder: number
}

export interface MenuItemOutletOverride {
  id: string
  menuItemId: string
  outletId: string
  outletName: string
  priceOverride: number | null
  isAvailable: boolean | null
  autoUnavailable: boolean | null
  displayOrder: number
}

export interface CreateMenuItemInput {
  categoryId: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  isVegetarian?: boolean
  displayOrder?: number
}

export interface UpdateMenuItemInput {
  categoryId?: string
  name?: string
  description?: string
  price?: number
  imageUrl?: string
  isVegetarian?: boolean
  isActive?: boolean
  displayOrder?: number
}

export interface CreateOptionInput {
  name: string
  kind: 'variant' | 'addon'
  priceDelta: number
  isActive?: boolean
  displayOrder?: number
}

export interface UpdateOptionInput {
  name?: string
  kind?: 'variant' | 'addon'
  priceDelta?: number
  isActive?: boolean
  displayOrder?: number
}

export interface OutletOverrideInput {
  outletId: string
  priceOverride?: number | null
  isAvailable?: boolean | null
  autoUnavailable?: boolean | null
}

export interface BulkOutletOverridesInput {
  overrides: OutletOverrideInput[]
}

export async function fetchCategories(params?: {
  page?: number
  limit?: number
  isActive?: boolean
  search?: string
}): Promise<CategoryListResponse> {
  const result = await api.get<CategoryListResponse>('/menu/categories', { params })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchCategory(id: string): Promise<Category> {
  const result = await api.get<Category>(`/menu/categories/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function createCategory(data: CreateCategoryInput): Promise<Category> {
  const result = await api.post<Category>('/menu/categories', data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
  const result = await api.patch<Category>(`/menu/categories/${id}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function deleteCategory(id: string): Promise<void> {
  const result = await api.delete(`/menu/categories/${id}`)
  if (result.error) throw new Error(result.error.message)
}

export async function fetchMenuItems(params?: {
  page?: number
  limit?: number
  categoryId?: string
  isActive?: boolean
  isVegetarian?: boolean
  search?: string
}): Promise<MenuItemListResponse> {
  const result = await api.get<MenuItemListResponse>('/menu/items', { params })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchMenuItem(id: string): Promise<MenuItem> {
  const result = await api.get<MenuItem>(`/menu/items/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function createMenuItem(data: CreateMenuItemInput): Promise<MenuItem> {
  const result = await api.post<MenuItem>('/menu/items', data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateMenuItem(id: string, data: UpdateMenuItemInput): Promise<MenuItem> {
  const result = await api.patch<MenuItem>(`/menu/items/${id}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function deleteMenuItem(id: string): Promise<void> {
  const result = await api.delete(`/menu/items/${id}`)
  if (result.error) throw new Error(result.error.message)
}

export async function uploadMenuImage(file: File): Promise<{ url: string; publicId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/menu/items/upload/image`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message ?? 'Failed to upload image')
  }
  
  return response.json()
}

export async function fetchMenuItemOptions(menuItemId: string, params?: {
  page?: number
  limit?: number
  kind?: 'variant' | 'addon'
  isActive?: boolean
}): Promise<{ data: MenuItemOption[]; meta: any }> {
  const result = await api.get<{ data: MenuItemOption[]; meta: any }>(`/menu/items/${menuItemId}/options`, { params })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function createMenuItemOption(menuItemId: string, data: CreateOptionInput): Promise<MenuItemOption> {
  const result = await api.post<MenuItemOption>(`/menu/items/${menuItemId}/options`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateMenuItemOption(optionId: string, data: UpdateOptionInput): Promise<MenuItemOption> {
  const result = await api.patch<MenuItemOption>(`/menu/items/options/${optionId}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function deleteMenuItemOption(optionId: string): Promise<void> {
  const result = await api.delete(`/menu/items/options/${optionId}`)
  if (result.error) throw new Error(result.error.message)
}

export async function fetchOutletOverrides(menuItemId: string): Promise<MenuItemOutletOverride[]> {
  const result = await api.get<MenuItemOutletOverride[]>(`/menu/items/${menuItemId}/outlet-overrides`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateOutletOverrides(menuItemId: string, data: BulkOutletOverridesInput): Promise<MenuItemOutletOverride[]> {
  const result = await api.put<MenuItemOutletOverride[]>(`/menu/items/${menuItemId}/outlet-overrides`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function toggleAvailability(menuItemId: string, outletId: string, isAvailable: boolean): Promise<MenuItemOutletOverride> {
  const result = await api.patch<MenuItemOutletOverride>(`/menu/items/${menuItemId}/availability`, { outletId, isAvailable })
  if (result.error) throw new Error(result.error.message)
  return result.data!
}