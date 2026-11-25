import { api, type ApiResult } from '@/lib/apiClient'

interface SuccessEnvelope<T> {
  success: boolean
  data: T
}

async function unwrap<T>(promise: Promise<ApiResult<SuccessEnvelope<T>>>): Promise<T> {
  const result = await promise
  if (result.error) throw new Error(result.error.message)
  return result.data.data
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

// ===== Organizations =====

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

export interface OrganizationDetail extends OrganizationListItem {
  outlets: Array<{ id: string; name: string; is_active: boolean }>
  subscriptions: Array<{ id: string; status: string; plan_code: string; plan_name: string; trial_ends_at: string | null }>
  staff: Array<{ id: string; full_name: string; email: string; roles: string[]; outlet_ids: string[] }>
}

export interface OrganizationsListResponse {
  data: OrganizationListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface OrganizationActionResponse {
  organization: OrganizationDetail
}

export async function fetchOrganizations(params?: {
  page?: number
  limit?: number
  status?: string
  search?: string
}): Promise<OrganizationsListResponse> {
  return unwrap(api.get<SuccessEnvelope<OrganizationsListResponse>>(`/super-admin/organizations${buildQuery(params ?? {})}`))
}

export async function fetchOrganizationDetail(id: string): Promise<OrganizationDetail> {
  return unwrap(api.get<SuccessEnvelope<OrganizationDetail>>(`/super-admin/organizations/${id}`))
}

export async function suspendOrganization(id: string): Promise<OrganizationActionResponse> {
  return unwrap(api.post<SuccessEnvelope<OrganizationActionResponse>>(`/super-admin/organizations/${id}/suspend`))
}

export async function reactivateOrganization(id: string): Promise<OrganizationActionResponse> {
  return unwrap(api.post<SuccessEnvelope<OrganizationActionResponse>>(`/super-admin/organizations/${id}/reactivate`))
}

export async function deleteOrganization(id: string): Promise<{ deleted: boolean }> {
  return unwrap(api.delete<SuccessEnvelope<{ deleted: boolean }>>(`/super-admin/organizations/${id}`))
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
  is_public: boolean
  subscription_count: number
  created_at: string
}

export interface PlanDetail extends PlanListItem {
  features: Record<string, unknown>
}

export interface PlansListResponse {
  data: PlanListItem[]
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
  return unwrap(api.get<SuccessEnvelope<PlansListResponse>>('/super-admin/plans'))
}

export async function fetchPlan(id: string): Promise<PlanDetail> {
  return unwrap(api.get<SuccessEnvelope<PlanDetail>>(`/super-admin/plans/${id}`))
}

export async function createPlan(data: CreatePlanInput): Promise<PlanDetail> {
  return unwrap(api.post<SuccessEnvelope<PlanDetail>>('/super-admin/plans', data))
}

export async function updatePlan(id: string, data: UpdatePlanInput): Promise<PlanDetail> {
  return unwrap(api.patch<SuccessEnvelope<PlanDetail>>(`/super-admin/plans/${id}`, data))
}

export async function deletePlan(id: string): Promise<{ deleted: boolean }> {
  return unwrap(api.delete<SuccessEnvelope<{ deleted: boolean }>>(`/super-admin/plans/${id}`))
}

// ===== Subscriptions =====

export interface SubscriptionListItem {
  id: string
  organization_id: string
  organization_name: string
  plan_id: string
  plan_code: string
  plan_name: string
  status: 'trialing' | 'active' | 'grace' | 'suspended' | 'cancelled'
  trial_ends_at: string | null
  grace_ends_at: string | null
  current_period_end: string | null
  max_outlets_override: number | null
  max_staff_override: number | null
  max_menu_items_override: number | null
  created_at: string
  updated_at: string
}

export interface SubscriptionDetail extends SubscriptionListItem {
  organization_id: string
  organization_name: string
  plan_id: string
  plan_code: string
  plan_name: string
}

export interface SubscriptionsListResponse {
  data: SubscriptionListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface UpdateOverridesInput {
  max_outlets_override: number | null
  max_staff_override: number | null
  max_menu_items_override: number | null
}

export interface ExtendTrialInput {
  days: number
}

export interface ChangePlanInput {
  plan_id: string
  prorate: boolean
}

export async function fetchSubscriptions(params?: {
  page?: number
  limit?: number
  status?: string
}): Promise<SubscriptionsListResponse> {
  return unwrap(api.get<SuccessEnvelope<SubscriptionsListResponse>>(`/super-admin/subscriptions${buildQuery(params ?? {})}`))
}

export async function fetchSubscriptionDetail(id: string): Promise<SubscriptionDetail> {
  return unwrap(api.get<SuccessEnvelope<SubscriptionDetail>>(`/super-admin/subscriptions/${id}`))
}

export async function updateSubscriptionOverrides(id: string, data: UpdateOverridesInput): Promise<SubscriptionDetail> {
  return unwrap(api.patch<SuccessEnvelope<SubscriptionDetail>>(`/super-admin/subscriptions/${id}/overrides`, data))
}

export async function extendSubscriptionTrial(id: string, days: number): Promise<SubscriptionDetail> {
  return unwrap(api.patch<SuccessEnvelope<SubscriptionDetail>>(`/super-admin/subscriptions/${id}/extend-trial`, { days }))
}

export async function changeSubscriptionPlan(id: string, data: ChangePlanInput): Promise<SubscriptionDetail> {
  return unwrap(api.patch<SuccessEnvelope<SubscriptionDetail>>(`/super-admin/subscriptions/${id}/change-plan`, data))
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
  data: Lead[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export async function fetchLeads(params?: {
  page?: number
  limit?: number
  handled?: 'true' | 'false'
}): Promise<LeadsListResponse> {
  return unwrap(api.get<SuccessEnvelope<LeadsListResponse>>(`/super-admin/leads${buildQuery(params ?? {})}`))
}

export async function fetchLead(id: string): Promise<Lead> {
  return unwrap(api.get<SuccessEnvelope<Lead>>(`/super-admin/leads/${id}`))
}

export async function markLeadHandled(id: string): Promise<{ handled: boolean }> {
  return unwrap(api.patch<SuccessEnvelope<{ handled: boolean }>>(`/super-admin/leads/${id}/handled`))
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
  pending: number
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
  return unwrap(api.get<SuccessEnvelope<PlatformStats>>('/super-admin/stats'))
}