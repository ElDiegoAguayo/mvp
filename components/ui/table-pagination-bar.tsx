'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TablePaginationBarProps {
  page: number
  totalPages: number
  totalItems: number
  startIndex: number
  endIndex: number
  onPageChange: (page: number) => void
  className?: string
  itemLabel?: string
}

export function TablePaginationBar({
  page,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  className,
  itemLabel = 'registros',
}: TablePaginationBarProps) {
  if (totalItems <= 0) return null

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2.5 border-t border-border bg-background/95 text-xs',
        className,
      )}
    >
      <p className="text-muted-foreground">
        Mostrando{' '}
        <span className="font-medium text-foreground tabular-nums">{startIndex + 1}–{endIndex}</span>
        {' de '}
        <span className="font-medium text-foreground tabular-nums">{totalItems}</span>
        {' '}{itemLabel}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Anterior
          </Button>
          <span className="px-2 tabular-nums text-muted-foreground min-w-[4.5rem] text-center">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
