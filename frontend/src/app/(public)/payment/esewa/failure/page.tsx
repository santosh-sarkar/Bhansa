'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { XCircle, Loader2, ArrowLeft, AlertCircle } from 'lucide-react'

function LoadingCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Processing...</h2>
          <p className="text-muted-foreground">Loading payment status...</p>
        </CardContent>
      </Card>
    </div>
  )
}

function EsewaFailureContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // eSewa v2 may redirect with a base64-encoded JSON `data` payload.
  const encoded = searchParams.get('data')
  let callback: Record<string, string> = {}
  if (encoded) {
    try {
      callback = JSON.parse(atob(encoded)) as Record<string, string>
    } catch {
      callback = {}
    }
  }

  const message = callback.message ?? searchParams.get('message')
  const transactionUuid = callback.transaction_uuid ?? searchParams.get('transaction_uuid')
  const errorDetails =
    message || (transactionUuid ? `Transaction ${transactionUuid} failed` : null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
          <p className="text-muted-foreground mb-6">
            Your eSewa payment could not be completed. This could be due to:
          </p>

          <ul className="text-left text-sm text-muted-foreground mb-6 space-y-2 max-w-xs mx-auto">
            <li className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Insufficient balance
            </li>
            <li className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Transaction timeout
            </li>
            <li className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Network error
            </li>
            <li className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Cancelled by user
            </li>
          </ul>

          {errorDetails && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg text-left text-sm text-red-700">
              <p className="font-medium mb-1">Error Details:</p>
              <p>{errorDetails}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
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

export default function EsewaFailurePage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <EsewaFailureContent />
    </Suspense>
  )
}
