'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listPhytoMovementsFullAction } from '@/app/actions/fitosanitario-extended-actions'
import type { PhytoMovement } from '@/lib/fitosanitario/types'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

export function PhytoMovementsManager() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const [rows, setRows] = useState<PhytoMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listPhytoMovementsFullAction()
    if (res.ok) setRows(res.data)
    else toast.error(res.message)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (!q) return true
      return (
        r.product?.name?.toLowerCase().includes(q)
        || r.field_name.toLowerCase().includes(q)
        || r.supplier_name.toLowerCase().includes(q)
        || r.warehouse?.name?.toLowerCase().includes(q)
      )
    })
  }, [rows, search, typeFilter])

  const pagination = usePagination(filtered, PHYTO_PAGE_SIZE)

  const fmtMoney = (n: number | null) =>
    n != null ? n.toLocaleString(dateLocale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '—'

  return (
    <DashboardCard header={<h2 className="text-lg font-semibold">{t('fitosanitario.movements.title')}</h2>}>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t('fitosanitario.movements.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('fitosanitario.movements.allTypes')}</SelectItem>
              <SelectItem value="entrada">{t('fitosanitario.movementTypes.entrada')}</SelectItem>
              <SelectItem value="salida">{t('fitosanitario.movementTypes.salida')}</SelectItem>
              <SelectItem value="ajuste">{t('fitosanitario.movementTypes.ajuste')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{t('fitosanitario.movements.columns.date')}</TableHead>
                  <TableHead>{t('fitosanitario.movements.columns.field')}</TableHead>
                  <TableHead>{t('fitosanitario.movements.columns.product')}</TableHead>
                  <TableHead>{t('fitosanitario.movements.columns.type')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.movements.columns.qty')}</TableHead>
                  <TableHead>{t('fitosanitario.movements.columns.productType')}</TableHead>
                  <TableHead>{t('fitosanitario.movements.columns.supplier')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.movements.columns.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.movement_date ? new Date(m.movement_date).toLocaleDateString(dateLocale) : '—'}</TableCell>
                    <TableCell>{m.field_name || m.warehouse?.name || '—'}</TableCell>
                    <TableCell className="font-medium">{m.product?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`fitosanitario.movementTypes.${m.type}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.quantity} {m.unit}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.product_type_label || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.supplier_name || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(m.total_clp)}</TableCell>
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
