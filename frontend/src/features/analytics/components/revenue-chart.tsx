'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/utils'
import type { RevenueByDay } from '@/features/analytics/services/analytics.api'
import { formatCompactCurrency, formatDayLabel } from '@/features/analytics/utils'

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'var(--primary)',
  },
} satisfies ChartConfig

export function RevenueChart({ data }: { data: RevenueByDay[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No revenue recorded in this period.
      </p>
    )
  }

  const chartData = data.map((day) => ({
    date: day.date,
    revenue: Number.parseFloat(day.revenue),
  }))

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-64 w-full"
      role="img"
      aria-label="Revenue by day chart"
    >
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value: string) => formatDayLabel(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => formatCompactCurrency(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(value) => formatDayLabel(String(value))}
              formatter={(value) => formatCurrency(Number(value))}
            />
          }
        />
        <Line
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
