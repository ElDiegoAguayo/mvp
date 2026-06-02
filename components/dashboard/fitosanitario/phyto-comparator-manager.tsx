'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { searchPhytoSupplierOffersAction } from '@/app/actions/fitosanitario-extended-actions'
import type { SupplierOfferRow } from '@/lib/fitosanitario/analytics'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { cn } from '@/lib/utils'
import { PhytoTablePagination } from '@/components/dashboard/fitosanitario/phyto-table-pagination'
import { PHYTO_PAGE_SIZE } from '@/lib/fitosanitario/constants'
import { usePagination } from '@/hooks/use-pagination'

export function PhytoComparatorManager() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const [rows, setRows] = useState<SupplierOfferRow[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [targets, setTargets] = useState<string[]>([])
  const [productType, setProductType] = useState('all')
  const [target, setTarget] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const runSearch = useCallback(() => {
    startTransition(async () => {
      setLoading(true)
      const res = await searchPhytoSupplierOffersAction({
        productType: productType === 'all' ? undefined : productType,
        target: target === 'all' ? undefined : target,
        search: search.trim() || undefined,
      })
      if (res.ok) {
        setRows(res.rows)
        setTypes(res.types)
        setTargets(res.targets)
      }
      setLoading(false)
    })
  }, [productType, target, search])

  useEffect(() => {
    runSearch()
  }, [runSearch])

  const fmtMoney = (n: number) =>
    n.toLocaleString(dateLocale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

  const minPrice = rows.length ? Math.min(...rows.map(r => r.unit_price)) : null

  const pagination = usePagination(rows, PHYTO_PAGE_SIZE)

  return (
    <DashboardCard header={<h2 className="text-lg font-semibold">{t('fitosanitario.comparator.title')}</h2>}>
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t('fitosanitario.comparator.subtitleNew')}</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-1">
            <Label className="text-xs">{t('fitosanitario.comparator.filters.productType')}</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('fitosanitario.analytics.allTypes')}</SelectItem>
                {types.map(tp => (
                  <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('fitosanitario.comparator.filters.target')}</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('fitosanitario.analytics.allTargets')}</SelectItem>
                {targets.map(tp => (
                  <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">{t('fitosanitario.comparator.filters.search')}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t('fitosanitario.comparator.filters.searchPlaceholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                />
              </div>
              <Button onClick={runSearch} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('fitosanitario.comparator.search')}
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">{t('fitosanitario.comparator.noOffers')}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t('fitosanitario.comparator.resultsCount', { count: rows.length })}
            </p>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>{t('fitosanitario.comparator.columns.supplier')}</TableHead>
                    <TableHead>{t('fitosanitario.comparator.columns.product')}</TableHead>
                    <TableHead>{t('fitosanitario.comparator.columns.type')}</TableHead>
                    <TableHead>{t('fitosanitario.comparator.columns.target')}</TableHead>
                    <TableHead className="text-right">{t('fitosanitario.comparator.columns.unitPrice')}</TableHead>
                    <TableHead>{t('fitosanitario.comparator.columns.unit')}</TableHead>
                    <TableHead className="text-right">{t('fitosanitario.comparator.columns.purchases')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map(r => (
                    <TableRow key={`${r.supplier_name}-${r.product_name}`}>
                      <TableCell className="font-medium">{r.supplier_name}</TableCell>
                      <TableCell>{r.product_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.product_type_label || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.target_label || '—'}</TableCell>
                      <TableCell className={cn(
                        'text-right tabular-nums font-semibold',
                        minPrice != null && r.unit_price === minPrice && 'text-emerald-600',
                      )}>
                        {fmtMoney(r.unit_price)}
                        {minPrice != null && r.unit_price === minPrice && (
                          <Badge className="ml-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" variant="outline">
                            {t('fitosanitario.comparator.bestPrice')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.purchase_count}</TableCell>
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
          </>
        )}
      </div>
    </DashboardCard>
  )
}
