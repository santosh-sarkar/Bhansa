export function formatCompactCurrency(amount: string | number): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (!Number.isFinite(value)) return 'Rs 0'
  return `NPR ${new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)}`
}

export function formatDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 am'
  if (hour === 12) return '12 pm'
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`
}

export function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}
