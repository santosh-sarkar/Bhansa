import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import type { AnalyticsSummary } from '@/features/analytics/services/analytics.api'

interface SummaryStatsProps {
  summary?: AnalyticsSummary
  isLoading: boolean
}

export function SummaryStats({ summary, isLoading }: SummaryStatsProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    )
  }

  const { revenue, orders, items, payments } = summary
  const topItem = items.top_items[0]

  const stats = [
    {
      label: 'Revenue',
      value: formatCurrency(revenue.total),
      hint: `${payments.succeeded} successful payment${payments.succeeded === 1 ? '' : 's'}`,
    },
    {
      label: 'Orders',
      value: orders.total.toLocaleString(),
      hint: `${orders.completed} completed · ${orders.cancelled} cancelled`,
    },
    {
      label: 'Average order value',
      value: formatCurrency(orders.average_order_value),
      hint: 'Across all orders in the period',
    },
    {
      label: 'Items sold',
      value: items.total_sold.toLocaleString(),
      hint: topItem ? `Top seller: ${topItem.name}` : 'No items sold yet',
    },
  ]

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{stat.label}</span>
          <span className="font-heading text-3xl font-semibold tabular-nums">
            {stat.value}
          </span>
          <span className="text-xs text-muted-foreground">{stat.hint}</span>
        </div>
      ))}
    </div>
  )
}
