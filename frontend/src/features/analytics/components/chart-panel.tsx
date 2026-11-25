'use client'

import { useState, type ReactNode } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ChartPanelProps {
  title: string
  description?: string
  isLoading?: boolean
  chart: ReactNode
  table: ReactNode
}

export function ChartPanel({ title, description, isLoading, chart, table }: ChartPanelProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>
          <ToggleGroup
            value={[view]}
            onValueChange={(value) => {
              const next = value[0]
              if (next === 'chart' || next === 'table') setView(next)
            }}
            variant="outline"
            size="sm"
            aria-label={`${title} view`}
          >
            <ToggleGroupItem value="chart" aria-label="Chart view">
              <BarChart3 data-icon="inline-start" />
              Chart
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view">
              <Table2 data-icon="inline-start" />
              Table
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : view === 'chart' ? chart : table}
      </CardContent>
    </Card>
  )
}
