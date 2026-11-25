'use client'

import { cn } from '@/lib/utils'
import { AlertCircle, Inbox, Search, Filter, Database, Package, Users, ClipboardList } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  variant?: 'default' | 'search' | 'filter' | 'empty'
}

const variantIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  default: Inbox,
  search: Search,
  filter: Filter,
  empty: Inbox,
}

const variantColors: Record<string, string> = {
  default: 'text-muted-foreground/50',
  search: 'text-blue-500/50',
  filter: 'text-yellow-500/50',
  empty: 'text-muted-foreground/50',
}

export function EmptyState({
  title,
  description,
  icon: CustomIcon,
  action,
  variant = 'default',
}: EmptyStateProps) {
  const Icon = CustomIcon ?? variantIcons[variant]
  const colorClass = variantColors[variant] ?? variantColors.default

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', variant === 'empty' && 'py-20')}>
      <div className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-full', colorClass)}>
        <Icon className="h-8 w-8" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="text-lg font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md">{description}</p>
        )}
      </div>
      {action && (
        <div className="mt-6">{action}</div>
      )}
    </div>
  )
}

// Specific empty states for common scenarios
export function NoDataEmptyState({ action }: { action?: React.ReactNode } = {}) {
  return (
    <EmptyState
      title="No data available"
      description="There are no records to display. Try adjusting your filters or add a new record."
      variant="empty"
      action={action}
    />
  )
}

export function NoSearchResultsEmptyState({ query, action }: { query?: string; action?: React.ReactNode } = {}) {
  return (
    <EmptyState
      icon={Search}
      title={query ? `No results for "${query}"` : 'No search results'}
      description={query
        ? 'Try adjusting your search terms or filters.'
        : 'Enter a search term to find records.'}
      variant="search"
      action={action}
    />
  )
}

export function NoFilterResultsEmptyState({ action }: { action?: React.ReactNode } = {}) {
  return (
    <EmptyState
      icon={Filter}
      title="No matching records"
      description="Try adjusting your filters or clearing them to see all records."
      variant="filter"
      action={action}
    />
  )
}

export function OfflineEmptyState({ action }: { action?: React.ReactNode } = {}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Unable to load data"
      description="Please check your connection and try again."
      variant="default"
      action={action}
    />
  )
}

// Specific domain empty states
export function NoOrdersEmptyState({ action }: { action?: React.ReactNode } = {}) {
  return (
    <EmptyState
      icon={ClipboardList}
      title="No orders yet"
      description="Orders will appear here when customers place them."
      action={action}
    />
  )
}

export function NoInventoryEmptyState({ action }: { action?: React.ReactNode } = {}) {
  return (
    <EmptyState
      icon={Package}
      title="No inventory items"
      description="Add ingredients to start tracking your inventory."
      action={action}
    />
  )
}

export function NoStaffEmptyState({ action }: { action?: React.ReactNode } = {}) {
  return (
    <EmptyState
      icon={Users}
      title="No team members yet"
      description="Invite your first staff member to get started."
      action={action}
    />
  )
}

export function NoTablesEmptyState({ action }: { action?: React.ReactNode } = {}) {
  return (
    <EmptyState
      icon={Database}
      title="No tables configured"
      description="Create tables to enable QR ordering for your guests."
      action={action}
    />
  )
}