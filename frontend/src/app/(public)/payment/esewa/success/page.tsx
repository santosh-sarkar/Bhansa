'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Loader2, ArrowLeft, AlertCircle } from 'lucide-react'
import { verifyEsewaPayment, type EsewaVerifyResponse } from '@/features/billing/services/billing.api'

function VerifyingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Verifying Payment</h2>
          <p className="text-muted-foreground">Please wait while we verify your eSewa payment...</p>
        </CardContent>
      </Card>
    </div>
  )
}

function EsewaSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying')
  const [paymentInfo, setPaymentInfo] = useState<EsewaVerifyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyPayment = async () => {
      // eSewa redirects to the success URL with a base64-encoded JSON `data`
      // parameter. Fall back to plain query params for compatibility.
      const encoded = searchParams.get('data')
      let callback: Record<string, string> = {}
      if (encoded) {
        try {
          callback = JSON.parse(atob(encoded)) as Record<string, string>
        } catch {
          setStatus('failed')
          setError('Invalid eSewa callback payload')
          return
        }
      }

      const data = {
        transaction_uuid: callback.transaction_uuid ?? searchParams.get('transaction_uuid') ?? '',
        status: callback.status ?? searchParams.get('status') ?? '',
        total_amount: callback.total_amount ?? searchParams.get('total_amount') ?? '',
        ref_id: callback.ref_id ?? searchParams.get('ref_id') ?? undefined,
        signed_field_names:
          callback.signed_field_names ?? searchParams.get('signed_field_names') ?? '',
        signature: callback.signature ?? searchParams.get('signature') ?? '',
      }

      if (!data.transaction_uuid || !data.status || !data.total_amount || !data.signed_field_names || !data.signature) {
        setStatus('failed')
        setError('Invalid eSewa callback parameters')
        return
      }

      try {
        const result = await verifyEsewaPayment(data)
        setPaymentInfo(result)
        if (result.status === 'succeeded') {
          setStatus('success')
        } else {
          setStatus('failed')
          setError('Payment was not successful')
        }
      } catch (err) {
        setStatus('failed')
        setError(err instanceof Error ? err.message : 'Payment verification failed')
      }
    }

    verifyPayment()
  }, [searchParams])

  if (status === 'verifying') {
    return <VerifyingFallback />
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-6">Your payment has been processed successfully.</p>

            {paymentInfo && (
              <div className="mb-6 p-4 bg-muted rounded-lg text-left">
                <p className="text-sm text-muted-foreground mb-1">Transaction ID</p>
                <p className="font-mono text-base">{paymentInfo.payment_id}</p>
                <p className="text-sm text-muted-foreground mt-2 mb-1">Amount Paid</p>
                <p className="font-bold text-lg">{paymentInfo.amount}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1" onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => router.push('/m/')}>
                Continue Ordering
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Payment Verification Failed</h2>
          <p className="text-muted-foreground mb-6">
            {error || 'We could not verify your payment. Please try again or contact support.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => router.refresh()}>
              Try Again
            </Button>
            <Button onClick={() => router.push('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function EsewaSuccessPage() {
  return (
    <Suspense fallback={<VerifyingFallback />}>
      <EsewaSuccessContent />
    </Suspense>
  )
}