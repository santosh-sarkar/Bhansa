import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import type { TopItem } from '@/features/analytics/services/analytics.api'

interface TopItemsTableProps {
  items: TopItem[]
  isLoading: boolean
}

export function TopItemsTable({ items, isLoading }: TopItemsTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No items sold in this period.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Sold</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={item.menu_item_id}>
            <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell className="text-right tabular-nums">{item.quantity_sold}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(item.revenue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
