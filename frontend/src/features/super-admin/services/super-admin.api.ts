import { api, type ApiResult, type PaginationMeta } from '@/lib/apiClient'

// ===== Types =====

export interface OrganizationListItem {
  id: string
  name: string
  slug: string
  status: string
  currency: string
  outlet_count: number
  staff_count: number
  subscription_status: string | null
  subscription_plan: string | null
  trial_ends_at: string | null
  grace_ends_at: string | null
  created_at: string
  deleted_at: string | null
}

export interface OrganizationStaffMember {
  id: string
  email: string
  full_name: string
  is_active: boolean
  role: string
  outlet_id: string | null
}

export interface OrganizationSubscription {
  id: string
  status: string
  plan_name: string | null
  plan_code: string | null
  trial_ends_at: string | null
  grace_ends_at: string | null
  current_period_end: string | null
}

export interface OrganizationDetail {
  id: string
  name: string
  slug: string
  status: string
  currency: string
  outlet_count: number
  staff_count: number
  subscription_status: string | null
  subscription_plan: string | null
  trial_ends_at: string | null
  grace_ends_at: string | null
  created_at: string
  deleted_at: string | null
  outlets: Array<{ id: string; name: string; is_active: boolean }>
  staff: OrganizationStaffMember[]
  subscription: OrganizationSubscription | null
  custom_plan_lead: {
    id: string
    contact_name: string
    contact_email: string
    outlet_count: number | null
    handled: boolean
    created_at: string
  } | null
}

export interface OrganizationsListResponse {
  organizations: OrganizationListItem[]
  pagination: PaginationMeta
}

export interface OrganizationActionResponse {
  success: boolean
}

// ===== Organizations =====

export async function fetchOrganizations(params?: {
  page?: number
  limit?: number
  status?: string
  search?: string
}): Promise<OrganizationsListResponse> {
  const result = await api.get<unknown[]>(`/super-admin/organizations${buildQuery(params ?? {})}`)
  if (result.error) throw new Error(result.error.message)
  const organizations = Array.isArray(result.data) ? (result.data as OrganizationListItem[]) : []
  const pagination =
    result.pagination ??
    ({ page: 1, limit: 20, total: organizations.length, totalPages: 1 } as PaginationMeta)
  return { organizations, pagination }
}

export async function fetchOrganizationDetail(id: string): Promise<OrganizationDetail> {
  const result = await api.get<OrganizationDetail>(`/super-admin/organizations/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function suspendOrganization(id: string): Promise<OrganizationActionResponse> {
  const result = await api.post<unknown>(`/super-admin/organizations/${id}/suspend`)
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? { success: true }) as OrganizationActionResponse
}

export async function reactivateOrganization(id: string): Promise<OrganizationActionResponse> {
  const result = await api.post<unknown>(`/super-admin/organizations/${id}/reactivate`)
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? { success: true }) as OrganizationActionResponse
}

export async function deleteOrganization(id: string): Promise<{ success: boolean }> {
  const result = await api.delete<unknown>(`/super-admin/organizations/${id}`)
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? { success: true }) as { success: boolean }
}

// ===== Plans =====

export interface PlanListItem {
  id: string
  code: string
  name: string
  price_monthly: string
  max_outlets: number
  max_staff: number | null
  max_menu_items: number | null
  multi_outlet_enabled: boolean
  features: Record<string, unknown>
  is_public: boolean
  subscription_count: number
  created_at: string
}

export type PlanDetail = PlanListItem

export interface PlansListResponse {
  plans: PlanListItem[]
}

export interface CreatePlanInput {
  code: string
  name: string
  price_monthly: string
  max_outlets: number
  max_staff: number | null
  max_menu_items: number | null
  multi_outlet_enabled: boolean
  features?: Record<string, unknown>
  is_public: boolean
}

export interface UpdatePlanInput {
  name?: string
  price_monthly?: string
  max_outlets?: number
  max_staff?: number | null
  max_menu_items?: number | null
  multi_outlet_enabled?: boolean
  features?: Record<string, unknown>
  is_public?: boolean
}

export async function fetchPlans(): Promise<PlansListResponse> {
  const result = await api.get<PlanListItem[]>('/super-admin/plans')
  if (result.error) throw new Error(result.error.message)
  const plans = Array.isArray(result.data) ? result.data : []
  return { plans }
}

export async function fetchPlan(id: string): Promise<PlanDetail> {
  const result = await api.get<PlanDetail>(`/super-admin/plans/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function createPlan(data: CreatePlanInput): Promise<PlanDetail> {
  const result = await api.post<PlanDetail>('/super-admin/plans', data)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function updatePlan(id: string, data: UpdatePlanInput): Promise<PlanDetail> {
  const result = await api.patch<PlanDetail>(`/super-admin/plans/${id}`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function deletePlan(id: string): Promise<{ success: boolean }> {
  const result = await api.delete<unknown>(`/super-admin/plans/${id}`)
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? { success: true }) as { success: boolean }
}

// ===== Subscriptions =====

export interface SubscriptionListItem {
  id: string
  organization_id: string
  organization_name: string
  plan_id: string
  plan_code: string
  plan_name: string
  status: string
  trial_ends_at: string | null
  grace_ends_at: string | null
  current_period_end: string | null
  max_outlets_override: number | null
  max_staff_override: number | null
  max_menu_items_override: number | null
  created_at: string
  updated_at: string
}

export type SubscriptionDetail = SubscriptionListItem

export interface UpdateSubscriptionOverridesInput {
  max_outlets_override: number | null
  max_staff_override: number | null
  max_menu_items_override: number | null
}

export interface ExtendTrialInput {
  trial_ends_at: string // ISO datetime string
}

export interface ChangePlanInput {
  plan_id: string
  current_period_end?: string // ISO datetime string, optional
}

export interface SubscriptionsListResponse {
  subscriptions: SubscriptionListItem[]
}

export async function fetchSubscriptions(): Promise<SubscriptionsListResponse> {
  const result = await api.get<SubscriptionListItem[]>('/super-admin/subscriptions')
  if (result.error) throw new Error(result.error.message)
  const subscriptions = Array.isArray(result.data) ? result.data : []
  return { subscriptions }
}

export async function fetchSubscriptionDetail(id: string): Promise<SubscriptionDetail> {
  const result = await api.get<SubscriptionDetail>(`/super-admin/subscriptions/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function updateSubscriptionOverrides(id: string, data: UpdateSubscriptionOverridesInput): Promise<SubscriptionDetail> {
  const result = await api.patch<SubscriptionDetail>(`/super-admin/subscriptions/${id}/overrides`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function extendSubscriptionTrial(id: string, trialEndsAt: string): Promise<SubscriptionDetail> {
  const result = await api.patch<SubscriptionDetail>(`/super-admin/subscriptions/${id}/extend-trial`, { trial_ends_at: trialEndsAt })
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function changeSubscriptionPlan(id: string, data: ChangePlanInput): Promise<SubscriptionDetail> {
  const result = await api.patch<SubscriptionDetail>(`/super-admin/subscriptions/${id}/change-plan`, data)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

// ===== Leads =====

export interface Lead {
  id: string
  organization_id: string | null
  organization_name: string | null
  contact_name: string
  contact_email: string
  outlet_count: number | null
  message: string | null
  handled: boolean
  created_at: string
}

export interface LeadsListResponse {
  leads: Lead[]
  pagination: PaginationMeta
}

export async function fetchLeads(params?: {
  page?: number
  limit?: number
  handled?: 'true' | 'false'
}): Promise<LeadsListResponse> {
  const result = await api.get<Lead[]>(`/super-admin/leads${buildQuery(params ?? {})}`)
  if (result.error) throw new Error(result.error.message)
  const leads = Array.isArray(result.data) ? result.data : []
  const pagination = result.pagination ?? ({ page: 1, limit: 20, total: leads.length, totalPages: 1 } as PaginationMeta)
  return { leads, pagination }
}

export async function fetchLead(id: string): Promise<Lead> {
  const result = await api.get<Lead>(`/super-admin/leads/${id}`)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function markLeadHandled(id: string): Promise<Lead> {
  const result = await api.patch<Lead>(`/super-admin/leads/${id}/handled`)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

// ===== Stats =====

export interface RevenueByPlan {
  plan_code: string
  plan_name: string
  amount: number
}

export interface StatsRevenue {
  total_paid: number
  this_month: number
  pending: number
  by_plan: RevenueByPlan[]
}

export interface StatsOrganizations {
  total: number
  active: number
  suspended: number
  deleted: number
}

export interface StatsSubscriptions {
  total: number
  trialing: number
  active: number
  grace: number
  suspended: number
  cancelled: number
}

export interface StatsPlans {
  total: number
  public: number
  subscription_distribution: Array<{ plan_id: string; plan_code: string; plan_name: string; count: number }>
}

export interface StatsOutlets {
  total: number
  active: number
}

export interface StatsStaff {
  total: number
  active: number
  by_role: Array<{ role: string; count: number }>
}

export interface StatsLeads {
  total: number
  handled: number
  unhandled: number
}

export interface StatsMonthlyRevenue {
  month: string
  amount: number
}

export interface PlatformStats {
  revenue: StatsRevenue
  organizations: StatsOrganizations
  subscriptions: StatsSubscriptions
  plans: StatsPlans
  outlets: StatsOutlets
  staff: StatsStaff
  leads: StatsLeads
  monthly_revenue: StatsMonthlyRevenue[]
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const result = await api.get<PlatformStats>('/super-admin/stats')
  if (result.error) throw new Error(result.error.message)
  return result.data
}

// ===== Helpers =====

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}
