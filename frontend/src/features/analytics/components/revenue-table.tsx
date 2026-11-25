import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import type { RevenueByDay } from '@/features/analytics/services/analytics.api'
import { formatDayLabel } from '@/features/analytics/utils'

export function RevenueTable({ data }: { data: RevenueByDay[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No revenue data for this period.</p>
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Avg. order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((day) => (
            <TableRow key={day.date}>
              <TableCell>{formatDayLabel(day.date)}</TableCell>
              <TableCell className="text-right tabular-nums">{day.orders}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(day.revenue)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(day.average_order_value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
