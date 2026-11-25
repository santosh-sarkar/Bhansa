import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { formatPercent } from '@/features/analytics/utils'
import type { AnalyticsSummary } from '@/features/analytics/services/analytics.api'

interface PaymentsBreakdownProps {
  summary?: AnalyticsSummary
  isLoading: boolean
}

export function PaymentsBreakdown({ summary, isLoading }: PaymentsBreakdownProps) {
  if (isLoading || !summary) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    )
  }

  const total = Number.parseFloat(summary.revenue.total)
  const methods = [
    { label: 'Cash', amount: summary.revenue.cash, color: 'var(--chart-1)' },
    { label: 'Online', amount: summary.revenue.online, color: 'var(--chart-2)' },
    { label: 'Card', amount: summary.revenue.card, color: 'var(--chart-3)' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {methods.map((method) => {
          const amount = Number.parseFloat(method.amount)
          return (
            <div key={method.label} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: method.color }}
              />
              <span className="flex-1 text-sm">{method.label}</span>
              <span className="text-sm tabular-nums">{formatCurrency(method.amount)}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {formatPercent(amount, total)}
              </span>
            </div>
          )
        })}
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Succeeded {summary.payments.succeeded}</Badge>
        <Badge variant={summary.payments.failed > 0 ? 'destructive' : 'outline'}>
          Failed {summary.payments.failed}
        </Badge>
        <Badge variant="outline">Pending {summary.payments.pending}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {summary.payments.total} payment attempt{summary.payments.total === 1 ? '' : 's'} in this period.
      </p>
    </div>
  )
}
