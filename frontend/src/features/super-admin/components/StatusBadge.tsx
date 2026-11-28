'use client'

import { cn } from '@/lib/utils'

const statusStyles: Record<string, { className: string; dotClassName: string }> = {
  active: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dotClassName: 'bg-green-500' },
  pending: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dotClassName: 'bg-yellow-500' },
  suspended: { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', dotClassName: 'bg-red-500' },
  deleted: { className: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300', dotClassName: 'bg-zinc-500' },
  trialing: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', dotClassName: 'bg-blue-500' },
  grace: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dotClassName: 'bg-yellow-500' },
  cancelled: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', dotClassName: 'bg-gray-500' },
  handled: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dotClassName: 'bg-green-500' },
  true: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dotClassName: 'bg-green-500' },
  false: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dotClassName: 'bg-yellow-500' },
  approved: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dotClassName: 'bg-green-500' },
  rejected: { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', dotClassName: 'bg-red-500' },
  inactive: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', dotClassName: 'bg-gray-500' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] ?? statusStyles.inactive
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', style.className, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dotClassName)} aria-hidden="true" />
      {status}
    </span>
  )
}
