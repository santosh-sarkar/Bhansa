'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Printer,
  CreditCard,
  FileText,
  Settings,
  CheckCircle,
  Receipt,
  DollarSign,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  fetchBills,
  fetchBillInvoice,
  fetchOpenSessions,
  generateBill,
  fetchPayments,
  fetchEsewaSettings,
  upsertEsewaSettings,
  deleteEsewaSettings,
  type BillStatus,
  type PaymentStatus,
  type PaymentMethod,
} from '@/features/billing/services/billing.api'
import { BillDetailDialog } from '@/features/billing/components/BillDetailDialog'
import {
  BillStatusBadge,
  PaymentMethodBadge,
  PaymentStatusBadge,
} from '@/features/billing/components/status-badge'
import {
  generateBillSchema,
  type GenerateBillForm,
  esewaSettingsSchema,
  type EsewaSettingsForm,
} from '@/features/billing/schemas'
import { formatCurrency, formatDate } from '@/lib/utils'

// ===== Bills List Tab =====

function BillsTab({ onViewBill }: { onViewBill: (id: string) => void }) {
  const queryClient = useQueryClient()
  const { hasPermission, getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | BillStatus>('all')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [sessionError, setSessionError] = useState('')

  const { data: billsData, isLoading } = useQuery({
    queryKey: ['bills', page, statusFilter],
    queryFn: () =>
      fetchBills({
        page,
        limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    enabled: !!outletId,
  })

  const bills = billsData?.data ?? []
  const totalPages = billsData?.pagination.totalPages ?? 1

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['open-sessions'],
    queryFn: fetchOpenSessions,
    enabled: !!outletId && generateOpen,
  })

  const generateForm = useForm<GenerateBillForm>({
    resolver: zodResolver(generateBillSchema),
    defaultValues: { discountAmount: '' },
  })

  const generateMutation = useMutation({
    mutationFn: (data: GenerateBillForm) =>
      generateBill(selectedSessionId, {
        discount_amount: data.discountAmount ? data.discountAmount : undefined,
      }),
    onSuccess: (bill) => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['open-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      generateForm.reset()
      setSelectedSessionId('')
      setGenerateOpen(false)
      onViewBill(bill.id)
    },
    onError: (err: Error) => alert(err.message),
  })

  const handleGenerateSubmit = (data: GenerateBillForm) => {
    if (!selectedSessionId) {
      setSessionError('Select a session to bill')
      return
    }
    generateMutation.mutate(data)
  }

  const openGenerateDialog = () => {
    generateForm.reset()
    setSelectedSessionId('')
    setSessionError('')
    setGenerateOpen(true)
  }

  const printInvoice = async (billId: string) => {
    try {
      const html = await fetchBillInvoice(billId)
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert('Allow pop-ups to print the invoice')
        return
      }
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.print()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load invoice')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Bills
        </h2>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v: string | null) => {
              setStatusFilter((v ?? 'all') as 'all' | BillStatus)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {hasPermission('payment.record') && (
            <Button onClick={openGenerateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Bill
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No bills found</h3>
              <p className="text-muted-foreground">Bills will appear here when generated.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Table / Session</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-medium font-mono">
                          {bill.invoice_number}
                        </TableCell>
                        <TableCell>
                          {bill.table_label ? (
                            <span className="font-medium">{bill.table_label}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Walk-in</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(bill.total)}
                        </TableCell>
                        <TableCell>
                          <BillStatusBadge status={bill.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(bill.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onViewBill(bill.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printInvoice(bill.id)}>
                                <Printer className="h-4 w-4 mr-2" />
                                Print Invoice
                              </DropdownMenuItem>
                              {bill.status === 'open' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => onViewBill(bill.id)}>
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Record Payment
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({billsData?.pagination.total ?? 0} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Generate Bill Dialog */}
      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          setGenerateOpen(open)
          if (!open) {
            generateForm.reset()
            setSelectedSessionId('')
            setSessionError('')
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={generateForm.handleSubmit(handleGenerateSubmit)}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Generate Bill</DialogTitle>
              <DialogDescription>
                Generate a bill for an open session with an optional discount.
              </DialogDescription>
            </DialogHeader>

            <div>
              <Label htmlFor="bill-session">Session *</Label>
              <Select
                value={selectedSessionId}
                onValueChange={(v: string | null) => {
                  setSelectedSessionId(v ?? '')
                  setSessionError('')
                }}
              >
                <SelectTrigger id="bill-session" className="w-full">
                  <SelectValue placeholder="Select a table session" />
                </SelectTrigger>
                <SelectContent>
                  {sessionsLoading ? (
                    <SelectItem value="__loading" disabled>
                      Loading sessions...
                    </SelectItem>
                  ) : sessions.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      No open sessions
                    </SelectItem>
                  ) : (
                    sessions.map((session) => {
                      const total = session.orders.reduce(
                        (sum, order) => sum + Number.parseFloat(order.total || '0'),
                        0
                      )
                      return (
                        <SelectItem key={session.id} value={session.id}>
                          {session.table_label} • {session.orders.length} order
                          {session.orders.length === 1 ? '' : 's'} • {formatCurrency(total)}
                        </SelectItem>
                      )
                    })
                  )}
                </SelectContent>
              </Select>
              {sessionError && <p className="text-sm text-destructive mt-1">{sessionError}</p>}
            </div>

            <div>
              <Label htmlFor="discountAmount">Discount Amount (optional)</Label>
              <Input
                id="discountAmount"
                type="number"
                step="0.01"
                {...generateForm.register('discountAmount')}
                placeholder="0.00"
              />
              {generateForm.formState.errors.discountAmount && (
                <p className="text-sm text-destructive">
                  {generateForm.formState.errors.discountAmount.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Payments Tab =====

function PaymentsTab() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all')
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all')

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments', page, statusFilter, methodFilter],
    queryFn: () =>
      fetchPayments({
        page,
        limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        method: methodFilter === 'all' ? undefined : methodFilter,
      }),
  })

  const payments = paymentsData?.data ?? []
  const totalPages = paymentsData?.pagination.totalPages ?? 1

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        Payments
      </h2>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[180px]">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v: string | null) => {
                  setStatusFilter((v ?? 'all') as 'all' | PaymentStatus)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label>Method</Label>
              <Select
                value={methodFilter}
                onValueChange={(v: string | null) => {
                  setMethodFilter((v ?? 'all') as 'all' | PaymentMethod)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No payments found</h3>
              <p className="text-muted-foreground">Payments will appear here when recorded.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recorded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono">
                          {payment.invoice_number || '-'}
                        </TableCell>
                        <TableCell>
                          <PaymentMethodBadge method={payment.method} />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={payment.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(payment.recorded_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({paymentsData?.pagination.total ?? 0} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===== eSewa Settings Tab =====

function EsewaSettingsTab() {
  const queryClient = useQueryClient()
  const { hasPermission, getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  const [isEditing, setIsEditing] = useState(false)

  const {
    data: settings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['esewa-settings', outletId],
    queryFn: () => fetchEsewaSettings(outletId!),
    enabled: !!outletId,
    retry: false,
  })

  const form = useForm<EsewaSettingsForm>({
    resolver: zodResolver(esewaSettingsSchema),
    defaultValues: {
      productCode: '',
      secretKey: '',
      isTestMode: true,
      isEnabled: false,
    },
  })

  const upsertMutation = useMutation({
    mutationFn: (data: EsewaSettingsForm) =>
      upsertEsewaSettings(outletId!, {
        product_code: data.productCode,
        secret_key: data.secretKey,
        is_test_mode: data.isTestMode,
        is_enabled: data.isEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['esewa-settings'] })
      setIsEditing(false)
      form.reset()
    },
    onError: (err: Error) => alert(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEsewaSettings(outletId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['esewa-settings'] })
      setIsEditing(false)
    },
    onError: (err: Error) => alert(err.message),
  })

  const handleSubmit = (data: EsewaSettingsForm) => upsertMutation.mutate(data)

  const openEdit = () => {
    form.reset({
      productCode: settings?.product_code ?? '',
      secretKey: '',
      isTestMode: settings?.is_test_mode ?? true,
      isEnabled: settings?.is_enabled ?? false,
    })
    setIsEditing(true)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete eSewa settings?')) {
      deleteMutation.mutate()
    }
  }

  if (!outletId) {
    return (
      <Alert>
        <AlertDescription>
          No outlet selected. Please select an outlet from the header.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Settings className="h-5 w-5" />
        eSewa Settings
      </h2>

      {isLoading ? (
        <Card>
          <CardContent>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : isError || !settings ? (
        <Card>
          <CardHeader>
            <CardTitle>eSewa Not Configured</CardTitle>
            <CardDescription>
              Configure eSewa settings to enable online payments for this outlet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasPermission('billing.manage') ? (
              <Button onClick={openEdit} disabled={upsertMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Configure eSewa
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                You do not have permission to configure eSewa.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>eSewa Configuration</CardTitle>
                <CardDescription>
                  Product Code: {settings.product_code} • Mode:{' '}
                  {settings.is_test_mode ? 'Test' : 'Live'} • Status:{' '}
                  {settings.is_enabled ? 'Enabled' : 'Disabled'}
                </CardDescription>
              </div>
              {hasPermission('billing.manage') && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={openEdit} disabled={upsertMutation.isPending}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Provider</dt>
                  <dd className="font-medium capitalize">{settings.provider}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Product Code</dt>
                  <dd className="font-mono">{settings.product_code}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Mode</dt>
                  <dd>
                    <Badge variant={settings.is_test_mode ? 'secondary' : 'default'}>
                      {settings.is_test_mode ? 'Test' : 'Live'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant={settings.is_enabled ? 'default' : 'secondary'}>
                      {settings.is_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Last Updated</dt>
                  <dd className="font-mono text-sm">{formatDate(settings.updated_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Edit Form */}
          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>{settings ? 'Edit' : 'Create'} eSewa Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="productCode">Product Code *</Label>
                    <Input
                      id="productCode"
                      {...form.register('productCode')}
                      placeholder="EPAYTEST or your product code"
                    />
                    {form.formState.errors.productCode && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.productCode.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="secretKey">Secret Key *</Label>
                    <Input
                      id="secretKey"
                      type="password"
                      {...form.register('secretKey')}
                      placeholder="Enter secret key (will be encrypted)"
                      autoComplete="off"
                    />
                    {form.formState.errors.secretKey && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.secretKey.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      The secret key is encrypted before storage. Re-enter it to save changes.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="isTestMode"
                        checked={form.watch('isTestMode')}
                        onCheckedChange={(checked) => form.setValue('isTestMode', checked)}
                      />
                      <Label htmlFor="isTestMode">Test Mode</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="isEnabled"
                        checked={form.watch('isEnabled')}
                        onCheckedChange={(checked) => form.setValue('isEnabled', checked)}
                      />
                      <Label htmlFor="isEnabled">Enabled</Label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={upsertMutation.isPending}>
                      {upsertMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        form.reset()
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ===== Main Page =====

export default function BillingPage() {
  const { getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  const [selectedBillId, setSelectedBillId] = useState<string | null>(null)

  if (!outletId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Select an outlet to view billing.</p>
        </div>
        <Alert>
          <AlertDescription>
            No outlet selected. Please select an outlet from the header.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage bills, payments, and eSewa settings.</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bills" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="esewa">eSewa Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="bills">
          <BillsTab onViewBill={setSelectedBillId} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>

        <TabsContent value="esewa">
          <EsewaSettingsTab />
        </TabsContent>
      </Tabs>

      {/* Bill Detail Dialog */}
      {selectedBillId && (
        <BillDetailDialog billId={selectedBillId} onClose={() => setSelectedBillId(null)} />
      )}
    </div>
  )
}
