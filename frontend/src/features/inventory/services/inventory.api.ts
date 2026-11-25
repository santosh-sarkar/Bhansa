import { api } from '@/lib/apiClient'

// ===== Ingredients =====

export interface Ingredient {
  id: string
  organizationId: string
  name: string
  unit: string
  defaultCost: string | null
  isActive: boolean
  outletStock?: Array<{
    outletId: string
    quantity: string
    lowThreshold: string
    outlet: { id: string; name: string }
  }>
  _count?: {
    outletStock: number
    recipeItems: number
  }
}

export interface IngredientListResponse {
  data: Ingredient[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CreateIngredientInput {
  name: string
  unit: string
  defaultCost?: string
  isActive?: boolean
}

export interface UpdateIngredientInput {
  name?: string
  unit?: string
  defaultCost?: string
  isActive?: boolean
}

export async function fetchIngredients(params?: {
  page?: number
  limit?: number
  isActive?: boolean
  search?: string
}): Promise<IngredientListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.isActive !== undefined) searchParams.set('is_active', params.isActive.toString())
  if (params?.search) searchParams.set('search', params.search)

  const result = await api.get<IngredientListResponse>(`/inventory/ingredients?${searchParams.toString()}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchIngredient(id: string): Promise<Ingredient> {
  const result = await api.get<{ ingredient: Ingredient }>(`/inventory/ingredients/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!.ingredient
}

export async function createIngredient(data: CreateIngredientInput): Promise<Ingredient> {
  const result = await api.post<{ ingredient: Ingredient }>('/inventory/ingredients', data)
  if (result.error) throw new Error(result.error.message)
  return result.data!.ingredient
}

export async function updateIngredient(id: string, data: UpdateIngredientInput): Promise<Ingredient> {
  const result = await api.patch<{ ingredient: Ingredient }>(`/inventory/ingredients/${id}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!.ingredient
}

export async function deleteIngredient(id: string): Promise<void> {
  const result = await api.delete(`/inventory/ingredients/${id}`)
  if (result.error) throw new Error(result.error.message)
}

// ===== Recipes =====

export interface RecipeItem {
  ingredientId: string
  ingredientName: string
  ingredientUnit: string
  quantity: string
}

export interface RecipeItemDetail extends RecipeItem {
  menuItemId: string
  menuItemName: string
}

export interface CreateRecipeItemInput {
  ingredientId: string
  quantity: string
}

export interface UpdateRecipeItemInput {
  quantity: string
}

export interface BulkUpsertRecipeInput {
  items: CreateRecipeItemInput[]
}

export async function fetchRecipeItems(menuItemId: string): Promise<RecipeItem[]> {
  const result = await api.get<{ items: RecipeItem[] }>(`/menu/items/${menuItemId}/recipe`)
  if (result.error) throw new Error(result.error.message)
  return result.data!.items
}

export async function fetchRecipeItem(menuItemId: string, ingredientId: string): Promise<RecipeItemDetail> {
  const result = await api.get<{ recipeItem: RecipeItemDetail }>(`/menu/items/${menuItemId}/recipe/${ingredientId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!.recipeItem
}

export async function createRecipeItem(menuItemId: string, data: CreateRecipeItemInput): Promise<RecipeItemDetail> {
  const result = await api.post<{ recipeItem: RecipeItemDetail }>(`/menu/items/${menuItemId}/recipe`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!.recipeItem
}

export async function updateRecipeItem(menuItemId: string, ingredientId: string, data: UpdateRecipeItemInput): Promise<RecipeItemDetail> {
  const result = await api.patch<{ recipeItem: RecipeItemDetail }>(`/menu/items/${menuItemId}/recipe/${ingredientId}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!.recipeItem
}

export async function deleteRecipeItem(menuItemId: string, ingredientId: string): Promise<void> {
  const result = await api.delete(`/menu/items/${menuItemId}/recipe/${ingredientId}`)
  if (result.error) throw new Error(result.error.message)
}

export async function bulkUpsertRecipe(menuItemId: string, data: BulkUpsertRecipeInput): Promise<RecipeItem[]> {
  const result = await api.put<{ items: RecipeItem[] }>(`/menu/items/${menuItemId}/recipe`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!.items
}

// ===== Outlet Stock =====

export interface OutletStock {
  outletId: string
  ingredientId: string
  ingredientName: string
  ingredientUnit: string
  quantity: string
  lowThreshold: string | null
  isLow: boolean
}

export interface OutletStockListResponse {
  data: OutletStock[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UpdateLowThresholdInput {
  lowThreshold: string
}

export interface BulkUpdateLowThresholdInput {
  items: Array<{ ingredientId: string; lowThreshold: string }>
}

export async function fetchOutletStock(outletId: string, params?: {
  page?: number
  limit?: number
  isLow?: boolean
  search?: string
}): Promise<OutletStockListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.isLow !== undefined) searchParams.set('is_low', params.isLow.toString())
  if (params?.search) searchParams.set('search', params.search)

  const result = await api.get<OutletStockListResponse>(`/outlets/${outletId}/stock?${searchParams.toString()}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function fetchOutletStockDetail(outletId: string, ingredientId: string): Promise<OutletStock> {
  const result = await api.get<OutletStock>(`/outlets/${outletId}/stock/${ingredientId}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function updateLowThreshold(outletId: string, ingredientId: string, data: UpdateLowThresholdInput): Promise<OutletStock> {
  const result = await api.patch<OutletStock>(`/outlets/${outletId}/stock/${ingredientId}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

export async function bulkUpdateLowThreshold(outletId: string, data: BulkUpdateLowThresholdInput): Promise<void> {
  const result = await api.put(`/outlets/${outletId}/stock/low-thresholds`, data)
  if (result.error) throw new Error(result.error.message)
}

// ===== Restock =====

export interface RestockInput {
  ingredientId: string
  quantity: string
  unitCost?: string
  supplier?: string
  reason?: string
}

export interface RestockResult {
  outletId: string
  ingredientId: string
  ingredientName: string
  ingredientUnit: string
  quantityBefore: string
  quantityAdded: string
  quantityAfter: string
  movementId: string
}

export async function recordRestock(outletId: string, data: RestockInput): Promise<RestockResult> {
  const result = await api.post<RestockResult>(`/outlets/${outletId}/stock/restock`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

// ===== Adjustment =====

export interface AdjustmentInput {
  ingredientId: string
  quantity: string
  unitCost?: string
  reason: string
}

export interface AdjustmentResult {
  outletId: string
  ingredientId: string
  ingredientName: string
  ingredientUnit: string
  quantityBefore: string
  quantityDelta: string
  quantityAfter: string
  movementId: string
}

export async function recordAdjustment(outletId: string, data: AdjustmentInput): Promise<AdjustmentResult> {
  const result = await api.post<AdjustmentResult>(`/outlets/${outletId}/stock/adjust`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

// ===== Wastage =====

export interface WastageInput {
  ingredientId: string
  quantity: string
  unitCost?: string
  reason: string
}

export interface WastageResult {
  outletId: string
  ingredientId: string
  ingredientName: string
  ingredientUnit: string
  quantityBefore: string
  quantityDelta: string
  quantityAfter: string
  movementId: string
}

export async function recordWastage(outletId: string, data: WastageInput): Promise<WastageResult> {
  const result = await api.post<WastageResult>(`/outlets/${outletId}/stock/wastage`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}

// ===== Stock Movements =====

export type MovementType = 'restock' | 'order_deduction' | 'order_restore' | 'adjustment' | 'wastage'

export interface StockMovement {
  id: string
  outletId: string
  ingredientId: string
  ingredientName: string
  ingredientUnit: string
  type: MovementType
  quantityDelta: string
  balanceAfter: string
  unitCost: string | null
  supplier: string | null
  reason: string | null
  orderId: string | null
  performedBy: string | null
  createdAt: string
}

export interface StockMovementListResponse {
  data: StockMovement[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function fetchStockMovements(outletId: string, params?: {
  page?: number
  limit?: number
  ingredientId?: string
  type?: MovementType
  startDate?: string
  endDate?: string
}): Promise<StockMovementListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.ingredientId) searchParams.set('ingredient_id', params.ingredientId)
  if (params?.type) searchParams.set('type', params.type)
  if (params?.startDate) searchParams.set('start_date', params.startDate)
  if (params?.endDate) searchParams.set('end_date', params.endDate)

  const result = await api.get<StockMovementListResponse>(`/outlets/${outletId}/stock/movements?${searchParams.toString()}`)
  if (result.error) throw new Error(result.error.message)
  return result.data!
}