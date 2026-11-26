'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { X, AlertCircle, Clock, DollarSign, Loader2, RefreshCw, CreditCard, Mail, Send, CheckCircle, Shield, Plus, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  fetchSubscription,
  submitCustomPlanRequest,
  submitSubscriptionPayment,
  type SubscriptionDetail,
  type CustomPlanRequestInput,
  type SubscriptionPaymentInput,
} from '@/features/subscription/services/subscription.api'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const subscriptionStatusConfig: Record<SubscriptionDetail['status'], { label: string; icon: React.ReactNode; color: string; description: string }> = {
  trialing: { label: 'Trial', icon: <Clock className="h-4 w-4" />, color: 'text-blue-600 bg-blue-50', description: 'Full access during trial period' },
  active: { label: 'Active', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600 bg-green-50', description: 'Subscription is active and in good standing' },
  grace: { label: 'Grace Period', icon: <Clock className="h-4 w-4" />, color: 'text-yellow-600 bg-yellow-50', description: 'Payment overdue - limited to read-only access' },
  suspended: { label: 'Suspended', icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-600 bg-red-50', description: 'Subscription suspended - access blocked' },
  cancelled: { label: 'Cancelled', icon: <X className="h-4 w-4" />, color: 'text-gray-600 bg-gray-50', description: 'Subscription cancelled - no access' },
}

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'text-yellow-600 bg-yellow-50' },
  approved: { label: 'Approved', color: 'text-green-600 bg-green-50' },
  rejected: { label: 'Rejected', color: 'text-red-600 bg-red-50' },
}

function ProgressBar({ current, limit, label }: { current: number; limit: number | null; label: string }) {
  if (!limit || limit <= 0) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span className="text-muted-foreground">{current} / Unlimited</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: '50%' }} />
        </div>
      </div>
    )
  }

  const percentage = Math.min(100, (current / limit) * 100)
  const isOverLimit = current > limit

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className={cn(isOverLimit && 'text-destructive')}>{current} / {limit}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isOverLimit ? 'bg-destructive' : percentage > 80 ? 'bg-yellow-500' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isOverLimit && <p className="text-xs text-destructive">Over limit - upgrade recommended</p>}
    </div>
  )
}

const paymentSchema = z.object({
  outlet_id: z.string().uuid('Please select an outlet'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(1, 'Currency is required'),
  payment_method: z.string().min(1, 'Payment method is required'),
  reference: z.string().min(1, 'Payment reference is required'),
  paid_at: z.string().min(1, 'Payment date is required'),
})

type PaymentForm = z.infer<typeof paymentSchema>

function PaymentForm({ outlets, onSuccess }: { outlets: { id: string; name: string }[]; onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      currency: 'NPR',
      paid_at: new Date().toISOString().split('T')[0],
    },
  })

  const onSubmit = async (data: PaymentForm) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await submitSubscriptionPayment(data)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive" className="gap-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="outlet_id">Outlet *</Label>
        <Select
          value={watch('outlet_id') ?? ''}
          onValueChange={(value) => setValue('outlet_id', value ?? '')}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select outlet" />
          </SelectTrigger>
          <SelectContent>
            {outlets.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.outlet_id && <p className="text-sm text-destructive">{errors.outlet_id.message}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            {...register('amount', { valueAsNumber: true })}
            disabled={isSubmitting}
            aria-invalid={!!errors.amount}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            {...register('currency')}
            disabled={isSubmitting}
            defaultValue="NPR"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="payment_method">Payment Method *</Label>
          <Select
            value={watch('payment_method') ?? ''}
            onValueChange={(value) => setValue('payment_method', value ?? '')}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="esewa">eSewa</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.payment_method && <p className="text-sm text-destructive">{errors.payment_method.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_at">Payment Date *</Label>
          <Input
            id="paid_at"
            type="date"
            {...register('paid_at')}
            disabled={isSubmitting}
            aria-invalid={!!errors.paid_at}
          />
          {errors.paid_at && <p className="text-sm text-destructive">{errors.paid_at.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reference">Payment Reference *</Label>
        <Input
          id="reference"
          placeholder="Transaction ID, receipt number, etc."
          {...register('reference')}
          disabled={isSubmitting}
          aria-invalid={!!errors.reference}
        />
        {errors.reference && <p className="text-sm text-destructive">{errors.reference.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Submit Payment
          </>
        )}
      </Button>
    </form>
  )
}

const customPlanSchema = z.object({
  contact_name: z.string().min(1, 'Contact name is required').max(100),
  contact_email: z.string().email('Valid email is required').max(254),
  outlet_count: z.number().int().min(1).max(100).optional(),
  message: z.string().max(2000).optional(),
})

type CustomPlanForm = z.infer<typeof customPlanSchema>

function CustomPlanForm({ onSuccess }: { onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomPlanForm>({
    resolver: zodResolver(customPlanSchema),
    defaultValues: {
      contact_name: '',
      contact_email: '',
      outlet_count: undefined,
      message: '',
    },
  })

  const onSubmit = async (data: CustomPlanForm) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await submitCustomPlanRequest(data)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive" className="gap-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="contact_name">Contact Name *</Label>
        <Input
          id="contact_name"
          {...register('contact_name')}
          disabled={isSubmitting}
          aria-invalid={!!errors.contact_name}
        />
        {errors.contact_name && <p className="text-sm text-destructive">{errors.contact_name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_email">Contact Email *</Label>
        <Input
          id="contact_email"
          type="email"
          {...register('contact_email')}
          disabled={isSubmitting}
          aria-invalid={!!errors.contact_email}
        />
        {errors.contact_email && <p className="text-sm text-destructive">{errors.contact_email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="outlet_count">Number of Outlets (optional)</Label>
        <Input
          id="outlet_count"
          type="number"
          min="1"
          max="100"
          placeholder="e.g., 5"
          {...register('outlet_count', { valueAsNumber: true })}
          disabled={isSubmitting}
          aria-invalid={!!errors.outlet_count}
        />
        {errors.outlet_count && <p className="text-sm text-destructive">{errors.outlet_count.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message (optional)</Label>
        <Textarea
          id="message"
          placeholder="Tell us about your requirements..."
          {...register('message')}
          disabled={isSubmitting}
          rows={4}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Submit Request
          </>
        )}
      </Button>
    </form>
  )
}

export default function SubscriptionPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()
  const canManageBilling = hasPermission('billing.manage')

  const { data: subscription, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: fetchSubscription,
    enabled: canManageBilling,
  })

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showCustomPlanForm, setShowCustomPlanForm] = useState(false)
  const [paymentOutlets] = useState<{ id: string; name: string }[]>([])

  if (!canManageBilling) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          You need the <code>billing.manage</code> permission to view subscription details.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>Failed to load subscription: {error.message}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </AlertDescription>
      </Alert>
    )
  }

  const sub = subscription
  const statusConfig = subscriptionStatusConfig[sub?.status ?? 'cancelled']
  const isInGrace = sub?.status === 'grace'
  const isSuspended = sub?.status === 'suspended'
  const isCancelled = sub?.status === 'cancelled'

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false)
    queryClient.invalidateQueries({ queryKey: ['subscription'] })
    queryClient.invalidateQueries({ queryKey: ['subscription', 'payments'] })
  }

  const handleCustomPlanSuccess = () => {
    setShowCustomPlanForm(false)
    queryClient.invalidateQueries({ queryKey: ['subscription'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <CreditCard className="h-8 w-8" aria-hidden="true" />
            Subscription
          </h1>
          <p className="text-muted-foreground">Manage your plan, billing, and usage limits.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Status Card */}
      <Card className={cn('border-l-4', statusConfig?.color.replace('text-', 'border-').replace('bg-', 'bg-').replace('50', '100'))}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn('rounded-full p-2', statusConfig?.color.replace('text-', 'bg-').replace('50', '100'))}>
                {statusConfig?.icon}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className={cn('font-heading text-2xl font-bold', statusConfig?.color.replace('bg-', '').replace('50', ''))}>
                  {statusConfig?.label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {sub?.trial_ends_at && (
                <>
                  <Clock className="h-4 w-4" /> Trial ends {formatDate(sub.trial_ends_at)}
                </>
              )}
              {sub?.grace_ends_at && (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-600" /> Grace ends {formatDate(sub.grace_ends_at)}
                </>
              )}
              {sub?.current_period_end && !sub?.trial_ends_at && (
                <>
                  <Calendar className="h-4 w-4" /> Period ends {formatDate(sub.current_period_end)}
                </>
              )}
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{statusConfig?.description}</p>
        </CardContent>
      </Card>

      {/* Plan Details & Usage */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plan Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>{sub?.plan?.name} ({sub?.plan?.code})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Price</span>
              <span className="font-heading text-xl font-bold">{formatCurrency(sub?.plan?.price_monthly ?? '0')} / month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Multi-outlet</span>
              <Badge variant={sub?.plan?.multi_outlet_enabled ? 'default' : 'secondary'}>
                {sub?.plan?.multi_outlet_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <Separator />

            <h4 className="font-medium">Plan Limits</h4>
            <div className="space-y-3">
              <ProgressBar
                current={sub?.usage?.outlets?.current ?? 0}
                limit={sub?.usage?.outlets?.limit ?? 0}
                label="Outlets"
              />
              <ProgressBar
                current={sub?.usage?.staff?.current ?? 0}
                limit={sub?.usage?.staff?.limit ?? null}
                label="Staff"
              />
              <ProgressBar
                current={sub?.usage?.menu_items?.current ?? 0}
                limit={sub?.usage?.menu_items?.limit ?? null}
                label="Menu Items"
              />
            </div>

            {(sub?.max_outlets_override || sub?.max_staff_override || sub?.max_menu_items_override) && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium mb-2">Subscription Overrides</p>
                <div className="grid gap-2 text-sm">
                  {sub?.max_outlets_override && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Outlets</span>
                      <span>{sub.max_outlets_override}</span>
                    </div>
                  )}
                  {sub?.max_staff_override && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Staff</span>
                      <span>{sub.max_staff_override}</span>
                    </div>
                  )}
                  {sub?.max_menu_items_override && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Menu Items</span>
                      <span>{sub.max_menu_items_override}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions / Payments / Custom Plan */}
        <Tabs defaultValue="payments" className="h-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="payments">
              <DollarSign className="h-4 w-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="custom-plan">
              <Mail className="h-4 w-4 mr-2" />
              Custom Plan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Payment History</h4>
              <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            </div>

            {/* Payment form would go here - simplified for now */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No payments yet</h3>
                  <p className="text-muted-foreground mb-4">Submit a payment reference when you make a payment.</p>
                  <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Submit Payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom-plan" className="mt-4 space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Request Custom Plan</h4>
                <p className="text-sm text-muted-foreground">Need more outlets, staff, or features? Submit a request and our team will contact you.</p>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <CustomPlanForm onSuccess={handleCustomPlanSuccess} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Form Dialog */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background w-full max-w-md mx-4 rounded-lg border shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Submit Payment</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPaymentForm(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <PaymentForm
              outlets={paymentOutlets}
              onSuccess={() => {
                setShowPaymentForm(false)
                queryClient.invalidateQueries({ queryKey: ['subscription'] })
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}