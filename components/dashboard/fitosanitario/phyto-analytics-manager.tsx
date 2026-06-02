'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPhytoSupplierAnalyticsAction } from '@/app/actions/fitosanitario-extended-actions'
import type { SupplierByTargetRow, SupplierByTypeRow, SupplierShareRow } from '@/lib/fitosanitario/analytics'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { toast } from 'sonner'
import { PhytoTablePagination } from '@/components/dashboard/fitosanitario/phyto-table-pagination'
import { PHYTO_PAGE_SIZE } from '@/lib/fitosanitario/constants'
import { usePagination } from '@/hooks/use-pagination'

const BAR_COLORS = ['#4063ca', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

function truncateLabel(name: string, max = 22): string {
  return name.length > max ? `${name.slice(0, max)}…` : name
}

export function PhytoAnalyticsManager() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const [shares, setShares] = useState<SupplierShareRow[]>([])
  const [byType, setByType] = useState<SupplierByTypeRow[]>([])
  const [byTarget, setByTarget] = useState<SupplierByTargetRow[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [targets, setTargets] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState('all')
  const [targetFilter, setTargetFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getPhytoSupplierAnalyticsAction({
      typeFilter: typeFilter === 'all' ? undefined : typeFilter,
      targetFilter: targetFilter === 'all' ? undefined : targetFilter,
    })
    if (res.ok) {
      setShares(res.shares)
      setByType(res.byType)
      setByTarget(res.byTarget)
      setTypes(res.types)
      setTargets(res.targets)
    } else toast.error(res.message)
    setLoading(false)
  }, [typeFilter, targetFilter])

  useEffect(() => { void load() }, [load])

  const fmtMoney = (n: number) =>
    n.toLocaleString(dateLocale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

  const barData = shares.slice(0, 12).map((s, i) => ({
    name: truncateLabel(s.supplier_name),
    fullName: s.supplier_name,
    share: Number(s.share_pct.toFixed(1)),
    total: s.total_clp,
    fill: BAR_COLORS[i % BAR_COLORS.length],
  }))

  const targetBarData = useMemo(() => {
    if (targetFilter === 'all') return []
    return byTarget.slice(0, 12).map((s, i) => ({
      name: truncateLabel(s.supplier_name),
      fullName: s.supplier_name,
      share: Number(s.share_pct.toFixed(1)),
      total: s.total_clp,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    }))
  }, [byTarget, targetFilter])

  const chartHeight = Math.max(240, barData.length * 44)

  const sharesPagination = usePagination(shares, PHYTO_PAGE_SIZE)
  const byTargetPagination = usePagination(byTarget, PHYTO_PAGE_SIZE)
  const byTypePagination = usePagination(byType, PHYTO_PAGE_SIZE)

  return (
    <div className="space-y-6">
      <DashboardCard
        header={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <h2 className="text-lg font-semibold">{t('fitosanitario.analytics.title')}</h2>
            <Select value={targetFilter} onValueChange={setTargetFilter}>
              <SelectTrigger className="w-full sm:w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('fitosanitario.analytics.allTargets')}</SelectItem>
                {targets.map(tp => (
                  <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : shares.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">{t('fitosanitario.analytics.empty')}</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div style={{ height: chartHeight }} className="min-h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, _key, item) => [
                      `${value}% · ${fmtMoney(item.payload.total)}`,
                      item.payload.fullName,
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="share" radius={[0, 4, 4, 0]} barSize={28} label={{ position: 'right', formatter: (v: number) => `${v}%`, fontSize: 11 }}>
                    {barData.map(entry => (
                      <Cell key={entry.fullName} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>{t('fitosanitario.analytics.columns.supplier')}</TableHead>
                    <TableHead className="text-right">{t('fitosanitario.analytics.columns.total')}</TableHead>
                    <TableHead className="text-right">{t('fitosanitario.analytics.columns.share')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sharesPagination.paginatedItems.map(s => (
                    <TableRow key={s.supplier_name}>
                      <TableCell className="font-medium">{s.supplier_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(s.total_clp)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.share_pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PhytoTablePagination
                page={sharesPagination.page}
                totalPages={sharesPagination.totalPages}
                totalItems={sharesPagination.totalItems}
                startIndex={sharesPagination.startIndex}
                endIndex={sharesPagination.endIndex}
                onPageChange={sharesPagination.setPage}
              />
            </div>
          </div>
        )}
      </DashboardCard>

      <DashboardCard header={<h3 className="font-semibold">{t('fitosanitario.analytics.byTargetTitle')}</h3>}>
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('fitosanitario.analytics.byTargetEmpty')}</p>
        ) : targetFilter !== 'all' && targetBarData.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{targetFilter}</p>
            <div style={{ height: Math.max(200, targetBarData.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={targetBarData} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number, _k, item) => [`${value}% · ${fmtMoney(item.payload.total)}`, item.payload.fullName]} />
                  <Bar dataKey="share" radius={[0, 4, 4, 0]} barSize={28} label={{ position: 'right', formatter: (v: number) => `${v}%`, fontSize: 11 }}>
                    {targetBarData.map(entry => (
                      <Cell key={entry.fullName} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{t('fitosanitario.analytics.columns.target')}</TableHead>
                  <TableHead>{t('fitosanitario.analytics.columns.supplier')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.analytics.columns.total')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.analytics.columns.share')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byTargetPagination.paginatedItems.map((r, i) => (
                  <TableRow key={`${r.target_label}-${r.supplier_name}-${i}`}>
                    <TableCell>{r.target_label}</TableCell>
                    <TableCell>{r.supplier_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(r.total_clp)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.share_pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PhytoTablePagination
              page={byTargetPagination.page}
              totalPages={byTargetPagination.totalPages}
              totalItems={byTargetPagination.totalItems}
              startIndex={byTargetPagination.startIndex}
              endIndex={byTargetPagination.endIndex}
              onPageChange={byTargetPagination.setPage}
            />
          </div>
        )}
      </DashboardCard>

      <DashboardCard
        header={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <h3 className="font-semibold">{t('fitosanitario.analytics.byTypeTitle')}</h3>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('fitosanitario.analytics.allTypes')}</SelectItem>
                {types.map(tp => (
                  <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {byType.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('fitosanitario.analytics.byTypeEmpty')}</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{t('fitosanitario.analytics.columns.productType')}</TableHead>
                  <TableHead>{t('fitosanitario.analytics.columns.supplier')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.analytics.columns.total')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.analytics.columns.share')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byTypePagination.paginatedItems.map((r, i) => (
                  <TableRow key={`${r.product_type_label}-${r.supplier_name}-${i}`}>
                    <TableCell>{r.product_type_label}</TableCell>
                    <TableCell>{r.supplier_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(r.total_clp)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.share_pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PhytoTablePagination
              page={byTypePagination.page}
              totalPages={byTypePagination.totalPages}
              totalItems={byTypePagination.totalItems}
              startIndex={byTypePagination.startIndex}
              endIndex={byTypePagination.endIndex}
              onPageChange={byTypePagination.setPage}
            />
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
