'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  changeSubscriptionPlan,
  createPlan,
  deleteOrganization,
  deletePlan,
  extendSubscriptionTrial,
  fetchLead,
  fetchLeads,
  fetchOrganizationDetail,
  fetchOrganizations,
  fetchSubscriptionDetail,
  fetchPlatformStats,
  fetchPlans,
  fetchSubscriptions,
  markLeadHandled,
  reactivateOrganization,
  suspendOrganization,
  updatePlan,
  updateSubscriptionOverrides,
  type Lead,
  type OrganizationDetail,
  type PlanListItem,
  type PlatformStats,
  type SubscriptionListItem,
} from '@/features/super-admin/services/super-admin.api'

export function useOrganizationsQuery(params?: { page?: number; limit?: number; status?: string; search?: string }) {
  return useQuery({
    queryKey: ['super-admin', 'organizations', params?.page ?? 1, params?.limit ?? 20, params?.status ?? '', params?.search ?? ''],
    queryFn: () => fetchOrganizations(params),
  })
}

export function useOrganizationDetailQuery(organizationId: string | null) {
  return useQuery({
    queryKey: ['super-admin', 'organizations', 'detail', organizationId],
    queryFn: () => fetchOrganizationDetail(organizationId!),
    enabled: !!organizationId,
  })
}

export function useLeadQuery(leadId: string | null) {
  return useQuery({
    queryKey: ['super-admin', 'leads', 'detail', leadId],
    queryFn: () => fetchLead(leadId!),
    enabled: !!leadId,
  })
}

export function useSubscriptionQuery(subscriptionId: string | null) {
  return useQuery({
    queryKey: ['super-admin', 'subscriptions', 'detail', subscriptionId],
    queryFn: () => fetchSubscriptionDetail(subscriptionId!),
    enabled: !!subscriptionId,
  })
}

export function usePlansQuery() {
  return useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => fetchPlans(),
  })
}

export function useSubscriptionsQuery() {
  return useQuery({
    queryKey: ['super-admin', 'subscriptions'],
    queryFn: () => fetchSubscriptions(),
  })
}

export function useLeadsQuery(params?: { page?: number; limit?: number; handled?: 'true' | 'false' }) {
  return useQuery({
    queryKey: ['super-admin', 'leads', params?.page ?? 1, params?.limit ?? 20, params?.handled ?? ''],
    queryFn: () => fetchLeads(params),
  })
}

export function usePlatformStatsQuery() {
  return useQuery({
    queryKey: ['super-admin', 'stats'],
    queryFn: () => fetchPlatformStats(),
  })
}

export function useSuspendOrganizationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => suspendOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}

export function useReactivateOrganizationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reactivateOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}

export function useDeleteOrganizationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}

export function useMarkLeadHandledMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markLeadHandled(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'leads'] })
    },
  })
}

export function useUpdateSubscriptionOverridesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: { max_outlets_override: number | null; max_staff_override: number | null; max_menu_items_override: number | null }
    }) => updateSubscriptionOverrides(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}

export function useExtendSubscriptionTrialMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, trialEndsAt }: { id: string; trialEndsAt: string }) => extendSubscriptionTrial(id, trialEndsAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}

export function useChangeSubscriptionPlanMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, planId }: { id: string; planId: string }) => changeSubscriptionPlan(id, { plan_id: planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}

export function useCreatePlanMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof createPlan>[0]) => createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}

export function useUpdatePlanMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePlan>[1] }) => updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}

export function useDeletePlanMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] })
    },
  })
}
