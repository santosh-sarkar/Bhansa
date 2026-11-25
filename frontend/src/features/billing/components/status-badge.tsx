import { Badge } from '@/components/ui/badge'
import {
  billStatusColors,
  billStatusLabels,
  paymentMethodColors,
  paymentStatusColors,
  paymentStatusLabels,
} from '@/features/billing/schemas'
import type { PaymentMethod, PaymentStatus } from '@/features/billing/services/billing.api'

export function BillStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={billStatusColors[status] ?? 'bg-gray-100 text-gray-800'}>
      {billStatusLabels[status] ?? status}
    </Badge>
  )
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <Badge variant="secondary" className={paymentMethodColors[method] ?? 'bg-gray-100 text-gray-800'}>
      {method.charAt(0).toUpperCase() + method.slice(1)}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="secondary" className={paymentStatusColors[status] ?? 'bg-gray-100 text-gray-800'}>
      {paymentStatusLabels[status] ?? status}
    </Badge>
  )
}
