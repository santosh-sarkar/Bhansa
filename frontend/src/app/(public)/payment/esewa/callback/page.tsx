'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ProcessingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-muted-foreground">Processing payment result...</p>
      </div>
    </div>
  )
}

function EsewaCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // eSewa v2 redirects with a base64-encoded JSON `data` parameter.
    // Older integrations use plain query params, so support both.
    const encoded = searchParams.get('data')
    let callback: Record<string, string> = {}
    if (encoded) {
      try {
        callback = JSON.parse(atob(encoded)) as Record<string, string>
      } catch {
        router.replace('/payment/esewa/failure?message=Invalid%20callback%20payload')
        return
      }
    }

    const status = callback.status ?? searchParams.get('status')
    const params = new URLSearchParams(searchParams.toString())

    if (encoded) {
      // Forward the decoded fields so the success page can verify them.
      Object.entries(callback).forEach(([key, value]) => params.set(key, value))
      params.delete('data')
    }

    if (status === 'COMPLETE' || status === 'SUCCESS') {
      router.replace(`/payment/esewa/success?${params.toString()}`)
    } else {
      router.replace(`/payment/esewa/failure?${params.toString()}`)
    }
  }, [router, searchParams])

  return <ProcessingScreen />
}

export default function EsewaCallbackPage() {
  return (
    <Suspense fallback={<ProcessingScreen />}>
      <EsewaCallbackContent />
    </Suspense>
  )
}
