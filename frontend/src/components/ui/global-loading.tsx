'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlobalLoadingProps {
  isLoading: boolean
  className?: string
}

export function GlobalLoading({ isLoading, className }: GlobalLoadingProps) {
  if (!isLoading) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-4 p-6 rounded-lg border bg-card shadow-lg">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading page...</p>
      </div>
    </div>
  )
}

export function InlineLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function ButtonLoading({ children, isLoading }: { children: React.ReactNode; isLoading: boolean }) {
  return (
    <>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />}
      {children}
    </>
  )
}