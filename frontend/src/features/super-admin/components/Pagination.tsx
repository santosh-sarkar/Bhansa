'use client'

import { Button } from '@/components/ui/button'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  isLoading?: boolean
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, isLoading, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between py-4 border-t">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} — {total} total
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1 || isLoading}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page === totalPages || isLoading}>
          Next
        </Button>
      </div>
    </div>
  )
}
