import { clsx, type ClassValue } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: string | number): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export function formatCompactCurrency(amount: string | number): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (!Number.isFinite(value)) return 'NPR 0'
  return `NPR ${new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)}`
}
