'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  deletePhytoApplicationItemAction,
  getPhytoProgramScheduleAction,
  savePhytoApplicationItemAction,
  savePhytoProgramDatesAction,
} from '@/app/actions/fitosanitario-extended-actions'
import { listPhytoProductsAction } from '@/app/actions/fitosanitario-actions'
import type { PhytoApplicationProgram, PhytoProduct } from '@/lib/fitosanitario/types'
import type { ScheduleRow } from '@/lib/fitosanitario/program-schedule'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, CalendarRange, Loader2, Plus, Trash2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PhytoTablePagination } from '@/components/dashboard/fitosanitario/phyto-table-pagination'
import { PHYTO_PAGE_SIZE } from '@/lib/fitosanitario/constants'
import { formatApplicationDate } from '@/lib/fitosanitario/format-period'
import { usePagination } from '@/hooks/use-pagination'

const emptyForm = () => ({
  product_name: '',
  product_id: '',
  stage_label: '',
  field_name: '',
  target_label: '',
  dose_label: '',
  spray_volume_l_ha: '',
  surface_ha: '',
  application_date: '',
  application_end_date: '',
  application_area_label: '',
  status: 'planned' as const,
})

export function PhytoProgramManager() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const [program, setProgram] = useState<PhytoApplicationProgram | null>(null)
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof getPhytoProgramScheduleAction>> extends { ok: true; coverage: infer R } ? R : never>([])
  const [products, setProducts] = useState<PhytoProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [isPending, startTransition] = useTransition()
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const load = useCallback(async (range?: { start: string; end: string }) => {
    setLoading(true)
    const [schedRes, pRes] = await Promise.all([
      getPhytoProgramScheduleAction({
        start_date: range?.start || null,
        end_date: range?.end || null,
      }),
      listPhytoProductsAction(),
    ])
    if (schedRes.ok) {
      setProgram(schedRes.program)
      setSchedule(schedRes.schedule)
      setCoverage(schedRes.coverage)
      if (!range?.start && !range?.end) {
        setDateRange({
          start: schedRes.program?.start_date ?? schedRes.inferredRange.start_date ?? '',
          end: schedRes.program?.end_date ?? schedRes.inferredRange.end_date ?? '',
        })
      }
    } else toast.error(schedRes.message)
    if (pRes.ok) setProducts(pRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const chartData = useMemo(() =>
    coverage.slice(0, 12).map(r => ({
      name: r.product_name.length > 18 ? `${r.product_name.slice(0, 16)}…` : r.product_name,
      planned: r.planned_total,
      stock: r.stock_total,
    })),
  [coverage])

  const depletionChart = useMemo(() =>
    schedule.map((s, i) => ({
      step: i + 1,
      label: s.application_date
        ? new Date(s.application_date).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' })
        : `#${i + 1}`,
      remaining: s.stock_after,
      product: s.product_name,
      sufficient: s.sufficient,
    })),
  [schedule, dateLocale])

  const insufficientCount = schedule.filter(s => !s.sufficient).length

  const schedulePagination = usePagination(schedule, PHYTO_PAGE_SIZE)

  const handleSaveDates = () => {
    if (!program?.id) {
      toast.error(t('fitosanitario.program.noProgram'))
      return
    }
    startTransition(async () => {
      const res = await savePhytoProgramDatesAction({
        program_id: program.id,
        start_date: dateRange.start || null,
        end_date: dateRange.end || null,
      })
      if (!res.ok) toast.error(res.message ?? 'Error')
      else {
        toast.success(t('fitosanitario.program.datesSaved'))
        await load(dateRange)
      }
    })
  }

  const handleApplyRange = () => {
    void load(dateRange)
  }

  const handleSave = () => {
    if (!form.product_name.trim()) {
      toast.error(t('fitosanitario.program.productRequired'))
      return
    }
    startTransition(async () => {
      const res = await savePhytoApplicationItemAction({
        program_id: program?.id,
        product_name: form.product_name,
        product_id: form.product_id || null,
        stage_label: form.stage_label,
        field_name: form.field_name,
        target_label: form.target_label,
        dose_label: form.dose_label,
        spray_volume_l_ha: form.spray_volume_l_ha ? Number(form.spray_volume_l_ha) : null,
        surface_ha: form.surface_ha ? Number(form.surface_ha) : null,
        application_date: form.application_date || null,
        application_end_date: form.application_end_date || dateRange.end || program?.end_date || null,
        application_area_label: form.application_area_label,
        status: form.status,
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('fitosanitario.program.saved'))
      setDialogOpen(false)
      setForm(emptyForm())
      await load(dateRange)
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deletePhytoApplicationItemAction(id)
      if (!res.ok) toast.error(res.message ?? 'Error')
      else await load(dateRange)
    })
  }

  return (
    <div className="space-y-6">
      <DashboardCard
        header={
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">{t('fitosanitario.program.title')}</h2>
                {program && (
                  <>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {program.name} · {program.field_name || t('fitosanitario.program.allFields')}
                    </p>
                    {(dateRange.start || dateRange.end) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('fitosanitario.program.seasonPeriod')}:{' '}
                        {formatApplicationDate(dateRange.start || null, locale)}
                        {(dateRange.end && dateRange.end !== dateRange.start) && (
                          <> · {t('fitosanitario.program.columns.dateTo')}{' '}
                            {formatApplicationDate(dateRange.end, locale)}</>
                        )}
                      </p>
                    )}
                  </>
                )}
              </div>
              <Button onClick={() => {
                setForm({
                  ...emptyForm(),
                  application_end_date: dateRange.end || program?.end_date || '',
                })
                setDialogOpen(true)
              }}>
                <Plus className="w-4 h-4 mr-2" />
                {t('fitosanitario.program.add')}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-end rounded-lg border border-border bg-muted/30 p-3">
              <CalendarRange className="w-5 h-5 text-muted-foreground shrink-0 hidden sm:block mb-2" />
              <div className="flex-1 grid sm:grid-cols-2 gap-3 w-full">
                <div className="space-y-1">
                  <Label className="text-xs">{t('fitosanitario.program.rangeStart')}</Label>
                  <Input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('fitosanitario.program.rangeEnd')}</Label>
                  <Input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={handleApplyRange} disabled={loading}>{t('fitosanitario.program.applyRange')}</Button>
                <Button onClick={handleSaveDates} disabled={isPending || !program?.id}>
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('fitosanitario.program.saveRange')}
                </Button>
              </div>
            </div>
            {insufficientCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {t('fitosanitario.program.insufficientWarning', { count: insufficientCount })}
              </div>
            )}
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : schedule.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">{t('fitosanitario.program.empty')}</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{t('fitosanitario.program.columns.dateFrom')}</TableHead>
                  <TableHead>{t('fitosanitario.program.columns.dateTo')}</TableHead>
                  <TableHead>{t('fitosanitario.program.columns.stage')}</TableHead>
                  <TableHead>{t('fitosanitario.program.columns.field')}</TableHead>
                  <TableHead>{t('fitosanitario.program.columns.product')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.program.columns.total')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.program.columns.stockBefore')}</TableHead>
                  <TableHead className="text-right">{t('fitosanitario.program.columns.stockAfter')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulePagination.paginatedItems.map(row => (
                  <TableRow key={row.item_id} className={cn(!row.sufficient && 'bg-rose-500/5')}>
                    <TableCell className="whitespace-nowrap">
                      {formatApplicationDate(row.application_date, locale)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatApplicationDate(
                        row.application_end_date ?? dateRange.end ?? program?.end_date ?? row.application_date,
                        locale,
                      )}
                    </TableCell>
                    <TableCell>{row.stage_label || '—'}</TableCell>
                    <TableCell>{row.field_name || '—'}</TableCell>
                    <TableCell className="font-medium">{row.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.qty.toLocaleString(dateLocale)} {row.unit}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{row.stock_before.toLocaleString(dateLocale)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums font-semibold', !row.sufficient && 'text-rose-600')}>
                      {row.stock_after.toLocaleString(dateLocale)} {row.unit}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(row.item_id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PhytoTablePagination
              page={schedulePagination.page}
              totalPages={schedulePagination.totalPages}
              totalItems={schedulePagination.totalItems}
              startIndex={schedulePagination.startIndex}
              endIndex={schedulePagination.endIndex}
              onPageChange={schedulePagination.setPage}
            />
          </div>
        )}
      </DashboardCard>

      <DashboardCard header={<h3 className="font-semibold">{t('fitosanitario.program.depletionTitle')}</h3>}>
        {depletionChart.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('fitosanitario.program.coverageEmpty')}</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={depletionChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [v.toLocaleString(dateLocale), t('fitosanitario.program.columns.stockAfter')]}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { product?: string; label?: string } | undefined
                    return p?.product ? `${p.label} · ${p.product}` : String(p?.label ?? '')
                  }}
                />
                <Line type="monotone" dataKey="remaining" name={t('fitosanitario.program.columns.stockAfter')} stroke="#4063ca" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardCard>

      <DashboardCard header={<h3 className="font-semibold">{t('fitosanitario.program.coverageTitle')}</h3>}>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('fitosanitario.program.coverageEmpty')}</p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="planned" name={t('fitosanitario.program.chartPlanned')} fill="#4063ca" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stock" name={t('fitosanitario.program.chartStock')} fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('fitosanitario.program.add')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('fitosanitario.program.form.product')}</Label>
              <Select
                value={form.product_id || '__custom'}
                onValueChange={v => {
                  if (v === '__custom') {
                    setForm(f => ({ ...f, product_id: '', product_name: '', target_label: '' }))
                    return
                  }
                  const p = products.find(x => x.id === v)
                  setForm(f => ({
                    ...f,
                    product_id: v,
                    product_name: p?.name ?? '',
                    target_label: p?.target_label ?? '',
                  }))
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom">{t('fitosanitario.program.form.customProduct')}</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.product_id && (
                <Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.program.form.target')}</Label>
              <Input value={form.target_label} onChange={e => setForm(f => ({ ...f, target_label: e.target.value }))} placeholder={t('fitosanitario.program.form.targetPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('fitosanitario.program.columns.stage')}</Label>
                <Input value={form.stage_label} onChange={e => setForm(f => ({ ...f, stage_label: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('fitosanitario.program.columns.field')}</Label>
                <Input value={form.field_name} onChange={e => setForm(f => ({ ...f, field_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('fitosanitario.program.form.dose')}</Label>
                <Input placeholder="300CC/100" value={form.dose_label} onChange={e => setForm(f => ({ ...f, dose_label: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('fitosanitario.program.form.spray')}</Label>
                <Input type="number" placeholder="1500" value={form.spray_volume_l_ha} onChange={e => setForm(f => ({ ...f, spray_volume_l_ha: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('fitosanitario.program.form.dateFrom')}</Label>
                <Input type="date" value={form.application_date} onChange={e => setForm(f => ({ ...f, application_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('fitosanitario.program.form.dateTo')}</Label>
                <Input type="date" value={form.application_end_date} onChange={e => setForm(f => ({ ...f, application_end_date: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">{t('fitosanitario.program.form.periodHint')}</p>
            <div className="space-y-2">
              <Label>{t('fitosanitario.program.columns.surface')}</Label>
              <Input type="number" step="any" value={form.surface_ha} onChange={e => setForm(f => ({ ...f, surface_ha: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.program.form.area')}</Label>
              <Input value={form.application_area_label} onChange={e => setForm(f => ({ ...f, application_area_label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.program.columns.status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as typeof form.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">{t('fitosanitario.program.status.planned')}</SelectItem>
                  <SelectItem value="applied">{t('fitosanitario.program.status.applied')}</SelectItem>
                  <SelectItem value="cancelled">{t('fitosanitario.program.status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('fitosanitario.program.cancel')}</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('fitosanitario.program.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
