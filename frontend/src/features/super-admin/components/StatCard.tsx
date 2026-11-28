'use client'

import { type ComponentType } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  color?: string
  subtitle?: string
}

export function StatCard({ title, value, icon: Icon, color = 'text-primary', subtitle }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-md bg-muted', color)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="font-heading text-2xl font-bold tabular-nums">{value}</span>
          {subtitle ? (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
