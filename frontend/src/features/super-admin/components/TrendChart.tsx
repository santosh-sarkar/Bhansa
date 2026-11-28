'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/utils'

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'var(--primary)',
  },
} satisfies ChartConfig

export interface TrendPoint {
  month: string
  amount: number
}

interface TrendChartProps {
  data: TrendPoint[]
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map((point) => ({
    month: point.month,
    revenue: Number(point.amount ?? 0),
  }))

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-64 w-full"
      role="img"
      aria-label="Monthly revenue chart"
    >
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value: string) => formatMonthLabel(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={72}
          tickFormatter={(value: number) => formatCurrency(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(value) => formatMonthLabel(String(value))}
              formatter={(value) => formatCurrency(Number(value))}
            />
          }
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} maxBarSize={40} />
      </BarChart>
    </ChartContainer>
  )
}

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
