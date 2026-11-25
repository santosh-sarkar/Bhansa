import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import type { PeakHour } from '@/features/analytics/services/analytics.api'
import { formatHourLabel } from '@/features/analytics/utils'

export function PeakHoursTable({ data }: { data: PeakHour[] }) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hour</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Avg. order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((hour) => (
            <TableRow key={hour.hour}>
              <TableCell>{formatHourLabel(hour.hour)}</TableCell>
              <TableCell className="text-right tabular-nums">{hour.orders}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(hour.revenue)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(hour.average_order_value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
