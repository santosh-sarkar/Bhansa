'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { PeakHour } from '@/features/analytics/services/analytics.api'
import { formatHourLabel } from '@/features/analytics/utils'

const chartConfig = {
  orders: {
    label: 'Orders',
    color: 'var(--primary)',
  },
} satisfies ChartConfig

export function PeakHoursChart({ data }: { data: PeakHour[] }) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-64 w-full"
      role="img"
      aria-label="Orders by hour of day chart"
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={2}
          tickFormatter={(value: number) => formatHourLabel(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(value) => formatHourLabel(Number(value))}
            />
          }
        />
        <Bar dataKey="orders" fill="var(--color-orders)" radius={4} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  )
}
