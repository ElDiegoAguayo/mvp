'use client'

import { TablePaginationBar } from '@/components/ui/table-pagination-bar'
import { useLocale } from '@/components/i18n/locale-provider'

interface PhytoTablePaginationProps {
  page: number
  totalPages: number
  totalItems: number
  startIndex: number
  endIndex: number
  onPageChange: (page: number) => void
}

export function PhytoTablePagination(props: PhytoTablePaginationProps) {
  const { t } = useLocale()
  return (
    <TablePaginationBar
      {...props}
      itemLabel={t('fitosanitario.pagination.items')}
    />
  )
}
