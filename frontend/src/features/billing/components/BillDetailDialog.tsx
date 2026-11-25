'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Printer,
  X,
  Receipt,
  Package,
  CreditCard,
  Coins,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  fetchBill,
  fetchBillInvoice,
  recordCashPayment,
  initiateEsewaPayment,
} from '@/features/billing/services/billing.api'
import { cashPaymentSchema, type CashPaymentForm } from '@/features/billing/schemas'
import { BillStatusBadge } from '@/features/billing/components/status-badge'

interface BillDetailDialogProps {
  billId: string
  onClose: () => void
}

export function BillDetailDialog({ billId, onClose }: BillDetailDialogProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [cashOpen, setCashOpen] = useState(false)
  const [esewaLoading, setEsewaLoading] = useState(false)

  const { data: bill, isLoading } = useQuery({
    queryKey: ['bill', billId],
    queryFn: () => fetchBill(billId),
    enabled: !!billId,
  })

  const cashPaymentForm = useForm<CashPaymentForm>({
    resolver: zodResolver(cashPaymentSchema),
    defaultValues: { amount: '', idempotencyKey: '' },
  })

  const cashPaymentMutation = useMutation({
    mutationFn: (data: CashPaymentForm) =>
      recordCashPayment(billId, {
        amount: data.amount,
        idempotency_key: data.idempotencyKey || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', billId] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      cashPaymentForm.reset()
      setCashOpen(false)
    },
    onError: (err: Error) => alert(err.message),
  })

  const openCashPaymentDialog = () => {
    cashPaymentForm.reset({ amount: bill?.total ?? '', idempotencyKey: '' })
    setCashOpen(true)
  }

  const handleEsewaPayment = async () => {
    if (!bill) return
    setEsewaLoading(true)
    try {
      const result = await initiateEsewaPayment(billId, {
        return_url: `${window.location.origin}/payment/esewa/success`,
      })

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = result.form_url
      Object.entries(result.form_fields).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to initiate eSewa payment')
    } finally {
      setEsewaLoading(false)
    }
  }

  const printInvoice = async () => {
    try {
      const html = await fetchBillInvoice(billId)
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.print()
      }
    } catch {
      alert('Failed to load invoice for printing')
    }
  }

  if (isLoading) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!bill) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <Alert>
            <AlertDescription>Bill not found</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-6 w-6" />
                Invoice {bill.invoice_number}
              </DialogTitle>
              <DialogDescription>
                {bill.table_label ? `Table: ${bill.table_label}` : 'Walk-in'} • {formatDate(bill.created_at)}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={printInvoice}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Status & Info */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Status</Label>
                <div>
                  <BillStatusBadge status={bill.status} />
                </div>
              </div>
              <div>
                <Label>Outlet</Label>
                <p className="font-medium">{bill.outlet_name}</p>
              </div>
              {bill.paid_at && (
                <div>
                  <Label>Paid At</Label>
                  <p className="font-mono text-sm">{formatDate(bill.paid_at)}</p>
                </div>
              )}
            </div>

            {/* Orders */}
            {bill.orders.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Orders ({bill.orders.length})
                </h4>
                {bill.orders.map((order) => (
                  <Card key={order.id} className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          Order #{order.order_number}
                          <BillStatusBadge status={order.status} />
                        </span>
                        <span className="font-mono text-sm">{formatCurrency(order.total)}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.item_name}</p>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground italic truncate">{item.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Qty: {item.quantity}</span>
                              <span className="font-mono">{formatCurrency(item.unit_price)}</span>
                              <span className="font-mono font-medium">{formatCurrency(item.line_total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-4 mt-2 text-sm">
                        <span>Subtotal: {formatCurrency(order.subtotal)}</span>
                        <span>Tax: {formatCurrency(order.tax_amount)}</span>
                        {Number.parseFloat(order.discount_amount) > 0 && (
                          <span className="text-destructive">
                            Discount: -{formatCurrency(order.discount_amount)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="border-t pt-4">
              <div className="flex flex-wrap justify-end gap-8">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="font-mono text-lg">{formatCurrency(bill.subtotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Tax (VAT)</p>
                  <p className="font-mono text-lg">{formatCurrency(bill.tax_amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Service Charge</p>
                  <p className="font-mono text-lg">{formatCurrency(bill.service_charge)}</p>
                </div>
                {Number.parseFloat(bill.discount_amount) > 0 && (
                  <div className="text-right text-destructive">
                    <p className="text-sm text-muted-foreground">Discount</p>
                    <p className="font-mono text-lg">-{formatCurrency(bill.discount_amount)}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-bold text-xl">{formatCurrency(bill.total)}</p>
                </div>
              </div>
            </div>

            {/* Payments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payments
                </h4>
                {bill.status === 'open' && hasPermission('payment.record') && (
                  <div className="flex gap-2">
                    <Button onClick={openCashPaymentDialog}>
                      <Coins className="h-4 w-4 mr-2" />
                      Cash
                    </Button>
                    <Button variant="outline" onClick={handleEsewaPayment} disabled={esewaLoading}>
                      {esewaLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      eSewa
                    </Button>
                  </div>
                )}
              </div>
              {bill.status === 'paid' && (
                <p className="text-sm text-muted-foreground">This bill has been paid.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Dialog */}
      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent>
          <form
            onSubmit={cashPaymentForm.handleSubmit((data) => cashPaymentMutation.mutate(data))}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Record Cash Payment</DialogTitle>
              <DialogDescription>
                Record cash payment for this bill. Bill total: {formatCurrency(bill.total)}
              </DialogDescription>
            </DialogHeader>

            <div>
              <Label htmlFor="cash-amount">Amount *</Label>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                {...cashPaymentForm.register('amount')}
                placeholder={formatCurrency(bill.total)}
              />
              {cashPaymentForm.formState.errors.amount && (
                <p className="text-sm text-destructive">
                  {cashPaymentForm.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="cash-idempotency-key">Idempotency Key (optional)</Label>
              <Input
                id="cash-idempotency-key"
                {...cashPaymentForm.register('idempotencyKey')}
                placeholder="Unique key to prevent duplicate payments"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCashOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={cashPaymentMutation.isPending}>
                {cashPaymentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Coins className="h-4 w-4 mr-2" />
                )}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
