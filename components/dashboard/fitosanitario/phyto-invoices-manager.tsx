'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listPhytoInvoicesAction } from '@/app/actions/fitosanitario-extended-actions'
import type { PhytoPurchaseInvoice } from '@/lib/fitosanitario/types'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Search } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { toast } from 'sonner'
import { PhytoTablePagination } from '@/components/dashboard/fitosanitario/phyto-table-pagination'
import { PHYTO_PAGE_SIZE } from '@/lib/fitosanitario/constants'
import { usePagination } from '@/hooks/use-pagination'

export function PhytoInvoicesManager() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const [rows, setRows] = useState<PhytoPurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listPhytoInvoicesAction()
    if (res.ok) setRows(res.data)
    else toast.error(res.message)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.product_name.toLowerCase().includes(q)
      || r.supplier_name.toLowerCase().includes(q)
      || r.field_name.toLowerCase().includes(q)
      || r.invoice_number.toLowerCase().includes(q),
    )
  }, [rows, search])

  const pagination = usePagination(filtered, PHYTO_PAGE_SIZE)

  const fmtMoney = (n: number | null) =>
    n != null ? n.toLocaleString(dateLocale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '—'

  const totalFiltered = filtered.reduce((s, r) => s + (r.total_clp ?? 0), 0)

  return (
    <DashboardCard header={<h2 className="text-lg font-semibold">{t('fitosanitario.invoices.title')}</h2>}>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t('fitosanitario.invoices.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('fitosanitario.invoices.total')}: <span className="font-semibold text-foreground">{fmtMoney(totalFiltered)}</span>
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{t('fitosanitario.invoices.columns.number')}</TableHead>
                  <TableHead>{t('fitosanitario.invoices.columns.supplier')}</TableHead>
                  <TableHead>{t('fitosanitario.invoices.columns.field')}</TableHead>
                  <TableHead>{t('fitosanitario.invoices.columns.date')}</TableHead>
                  <TableHead>{t('fitosanitario.invoices.columns.product')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.invoices.columns.qty')}</TableHead>
                  <TableHead>{t('fitosanitario.invoices.columns.type')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.invoices.columns.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.invoice_number || '—'}</TableCell>
                    <TableCell>{inv.supplier_name || '—'}</TableCell>
                    <TableCell>{inv.field_name || '—'}</TableCell>
                    <TableCell>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString(dateLocale) : '—'}</TableCell>
                    <TableCell className="font-medium">{inv.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{inv.quantity} {inv.unit}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.product_type_label || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtMoney(inv.total_clp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PhytoTablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setPage}
            />
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
