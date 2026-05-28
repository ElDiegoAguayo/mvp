'use client'

import { useEffect, useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE = 10

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  useEffect(() => {
    setPage(1)
  }, [totalItems, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const startIndex = totalItems === 0 ? 0 : (page - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  return {
    page,
    setPage,
    totalPages,
    totalItems,
    pageSize,
    paginatedItems,
    startIndex,
    endIndex,
    hasPagination: totalItems > pageSize,
  }
}
