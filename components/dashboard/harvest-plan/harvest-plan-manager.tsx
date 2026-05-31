'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CalendarRange, ExternalLink, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { countGroupKey, listCountGroupSummaries } from '@/lib/agronomy/count-group-averages'
import { buildEstimationFromCountSummary } from '@/lib/agronomy/build-estimation-from-count'
import { currentSeasonLabel, formatKg } from '@/lib/agronomy/format'
import { HARVEST_CROPS } from '@/lib/agronomy/harvest-yields'
import { buildHarvestPlanRows, formatWindowRange, isCountSampleRow, type HarvestPlanRow } from '@/lib/agronomy/harvest-plan-windows'
import { HarvestPlanGantt, HarvestPlanTable } from '@/components/dashboard/harvest-plan/harvest-plan-gantt'
import { HarvestPlanSummary, HarvestPlanWeekBuckets } from '@/components/dashboard/harvest-plan/harvest-plan-summary'
import { useLocale } from '@/components/i18n/locale-provider'

interface HarvestEstimate {
  id: string
  field_name: string | null
  block_name: string
  crop: string
  variety: string | null
  season_label: string
  record_date: string | null
  hectares: number | null
  plants_per_ha: number | null
  dardos_per_plant: number | null
  dardos_per_branch: number | null
  dardo_coral: number | null
  hilera: number | null
  arbol: number | null
  is_count_summary: boolean | null
  count_sample_count: number | null
  count_state: string | null
  estimated_kg: number
  expected_start: string | null
  expected_end: string | null
}

interface HarvestBlock {
  field_name: string
  block_name: string
  crop: string
  variety: string | null
  hectares: number | null
  plants_per_ha: number | null
}

const ALL = 'all'

interface HarvestPlanManagerProps {
  /** Dentro de Estimación de cosecha (pestaña integrada). */
  embedded?: boolean
}

export function HarvestPlanManager({ embedded = false }: HarvestPlanManagerProps) {
  const supabase = useMemo(() => createClient(), [])
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<HarvestEstimate[]>([])
  const [blocks, setBlocks] = useState<HarvestBlock[]>([])
  const [filterSeason, setFilterSeason] = useState('')
  const [filterCrop, setFilterCrop] = useState(ALL)
  const [filterField, setFilterField] = useState(ALL)
  const [filterBlock, setFilterBlock] = useState(ALL)
  const [filterVariety, setFilterVariety] = useState(ALL)
  const [editRow, setEditRow] = useState<HarvestPlanRow | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { effectiveUserId } = await getEffectiveUserId(supabase)
    if (!effectiveUserId) {
      setLoading(false)
      return
    }

    const [estRes, blockRes] = await Promise.all([
      supabase.from('harvest_estimates').select('*').eq('user_id', effectiveUserId).order('record_date', { ascending: false }),
      supabase.from('harvest_blocks').select('field_name, block_name, crop, variety, hectares, plants_per_ha').eq('user_id', effectiveUserId),
    ])

    if (estRes.error) toast.error(t('estimacionCosecha.toasts.planLoadFailed'))
    else setRows((estRes.data ?? []) as HarvestEstimate[])

    if (!blockRes.error) setBlocks((blockRes.data ?? []) as HarvestBlock[])

    setLoading(false)
  }, [supabase, t])

  useEffect(() => { load() }, [load])

  const seasons = useMemo(
    () => [...new Set(rows.map((r) => r.season_label).filter(Boolean))].sort().reverse(),
    [rows],
  )

  useEffect(() => {
    if (!filterSeason && seasons.length > 0) setFilterSeason(seasons[0]!)
    if (!filterSeason && seasons.length === 0) setFilterSeason(currentSeasonLabel())
  }, [seasons, filterSeason])

  const seasonRows = useMemo(
    () => rows.filter((r) => !filterSeason || r.season_label === filterSeason),
    [rows, filterSeason],
  )

  const countRows = useMemo(
    () => seasonRows.filter((r) => r.hilera != null || r.arbol != null || r.is_count_summary === false),
    [seasonRows],
  )

  const estimationRows = useMemo(
    () => seasonRows.filter((r) =>
      r.is_count_summary === true
      || (r.is_count_summary == null && r.hilera == null && r.arbol == null),
    ),
    [seasonRows],
  )

  const countSummaries = useMemo(() => {
    const fromSamples = listCountGroupSummaries(countRows)
    const keysWithSamples = new Set(fromSamples.map((s) => countGroupKey(s)))
    const fromManual = estimationRows
      .filter((r) => !keysWithSamples.has(countGroupKey(r)))
      .map((r) => ({
        field_name: r.field_name ?? '',
        block_name: r.block_name,
        variety: r.variety ?? r.crop,
        count_state: (r.count_state ?? 'Pre-poda') as string,
        hilera: r.hilera,
        arbol: r.arbol,
        dardos_per_plant: r.dardos_per_plant,
        dardos_per_branch: r.dardos_per_branch,
        dardo_coral: r.dardo_coral,
        sample_count: r.count_sample_count ?? 1,
      }))
    return [...fromSamples, ...fromManual]
  }, [countRows, estimationRows])

  const estimationDisplayRows = useMemo((): HarvestEstimate[] => {
    const season = filterSeason || seasons[0] || currentSeasonLabel()
    if (countSummaries.length === 0) return estimationRows

    return countSummaries.map((summary) => {
      const block = blocks.find(
        (b) => b.field_name === summary.field_name && b.block_name === summary.block_name,
      )
      const existing = estimationRows.find(
        (r) => countGroupKey(r) === countGroupKey(summary) && r.season_label === season,
      )
      const hectares = (existing?.hectares != null && existing.hectares > 0)
        ? existing.hectares
        : (block?.hectares != null && block.hectares > 0 ? block.hectares : 0)
      const built = buildEstimationFromCountSummary(summary, {
        season_label: season,
        block: block ?? (hectares > 0 ? {
          field_name: summary.field_name,
          block_name: summary.block_name,
          crop: existing?.crop ?? 'Cerezo',
          variety: summary.variety,
          hectares,
          plants_per_ha: existing?.plants_per_ha ?? null,
        } : null),
        crop: block?.crop ?? existing?.crop,
      })

      return {
        id: existing?.id ?? `computed-${countGroupKey(summary)}::${season}`,
        field_name: built.field_name,
        block_name: built.block_name,
        crop: built.crop,
        variety: built.variety || null,
        season_label: season,
        hectares: built.hectares,
        plants_per_ha: built.plants_per_ha,
        dardos_per_plant: built.dardos_per_plant,
        dardos_per_branch: built.dardos_per_branch,
        dardo_coral: built.dardo_coral,
        hilera: null,
        arbol: null,
        is_count_summary: true,
        count_sample_count: summary.sample_count,
        count_state: summary.count_state,
        estimated_kg: built.estimated_kg,
        expected_start: existing?.expected_start ?? null,
        expected_end: existing?.expected_end ?? null,
      } as HarvestEstimate
    })
  }, [countSummaries, estimationRows, blocks, filterSeason, seasons])

  const filteredEstimates = useMemo(() => {
    return estimationDisplayRows.filter((r) => {
      if (filterCrop !== ALL && r.crop !== filterCrop) return false
      if (filterField !== ALL && (r.field_name ?? '') !== filterField) return false
      if (filterBlock !== ALL && r.block_name !== filterBlock) return false
      if (filterVariety !== ALL && (r.variety ?? '') !== filterVariety) return false
      return true
    })
  }, [estimationDisplayRows, filterCrop, filterField, filterBlock, filterVariety])

  const countRecordsForPlan = useMemo(
    () => seasonRows
      .filter((r) => isCountSampleRow(r))
      .map((r) => ({
        field_name: r.field_name,
        block_name: r.block_name,
        crop: r.crop,
        season_label: r.season_label,
        record_date: r.record_date,
        count_state: r.count_state,
        hilera: r.hilera,
        arbol: r.arbol,
        is_count_summary: r.is_count_summary,
      })),
    [seasonRows],
  )

  const planRows = useMemo(
    () => buildHarvestPlanRows(
      filteredEstimates.map((r) => ({
        id: r.id.startsWith('computed-') ? null : r.id,
        field_name: r.field_name,
        block_name: r.block_name,
        crop: r.crop,
        variety: r.variety,
        season_label: r.season_label,
        estimated_kg: r.estimated_kg,
        expected_start: r.expected_start,
        expected_end: r.expected_end,
      })),
      countRecordsForPlan,
    ),
    [filteredEstimates, countRecordsForPlan],
  )

  const fieldsInUse = useMemo(
    () => [...new Set(planRows.map((r) => r.field_name).filter((f) => f !== '—'))].sort((a, b) => a.localeCompare(b, 'es')),
    [planRows],
  )
  const blocksInUse = useMemo(
    () => [...new Set(planRows.map((r) => r.block_name))].sort((a, b) => a.localeCompare(b, 'es')),
    [planRows],
  )
  const varietiesInUse = useMemo(
    () => [...new Set(planRows.map((r) => r.variety))].sort((a, b) => a.localeCompare(b, 'es')),
    [planRows],
  )
  const cropsInUse = useMemo(
    () => [...new Set(planRows.map((r) => r.crop))].sort((a, b) => a.localeCompare(b, 'es')),
    [planRows],
  )

  const summary = useMemo(() => {
    const totalKg = planRows.reduce((s, r) => s + r.estimated_kg, 0)
    return {
      totalKg,
      blockCount: new Set(planRows.map((r) => r.block_name)).size,
      fieldCount: new Set(planRows.map((r) => r.field_name)).size,
      manualCount: planRows.filter((r) => r.source === 'manual').length,
      countSourceCount: planRows.filter((r) => r.source === 'count').length,
      earliestStart: planRows.length > 0 ? planRows.reduce((min, r) => (r.window_start < min ? r.window_start : min), planRows[0]!.window_start) : null,
      latestEnd: planRows.length > 0 ? planRows.reduce((max, r) => (r.window_end > max ? r.window_end : max), planRows[0]!.window_end) : null,
    }
  }, [planRows])

  function openEdit(row: HarvestPlanRow) {
    setEditRow(row)
    setEditStart(row.window_start)
    setEditEnd(row.window_end)
  }

  async function saveWindow() {
    if (!editRow?.id) return
    if (!editStart || !editEnd) {
      toast.error(t('estimacionCosecha.toasts.windowDatesRequired'))
      return
    }
    if (editStart > editEnd) {
      toast.error(t('estimacionCosecha.toasts.startBeforeEnd'))
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('harvest_estimates')
      .update({ expected_start: editStart, expected_end: editEnd })
      .eq('id', editRow.id)

    setSaving(false)
    if (error) {
      toast.error(t('estimacionCosecha.toasts.windowSaveFailed'))
      return
    }
    toast.success(t('estimacionCosecha.toasts.windowUpdated'))
    setEditRow(null)
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> {t('estimacionCosecha.plan.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.season')}</label>
            <Select value={filterSeason || seasons[0] || currentSeasonLabel()} onValueChange={setFilterSeason}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(seasons.length > 0 ? seasons : [currentSeasonLabel()]).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.crop')}</label>
            <Select value={filterCrop} onValueChange={setFilterCrop}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('estimacionCosecha.plan.all')}</SelectItem>
                {(cropsInUse.length > 0 ? cropsInUse : [...HARVEST_CROPS]).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.field')}</label>
            <Select value={filterField} onValueChange={setFilterField}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('estimacionCosecha.plan.all')}</SelectItem>
                {fieldsInUse.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.block')}</label>
            <Select value={filterBlock} onValueChange={setFilterBlock}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('estimacionCosecha.plan.all')}</SelectItem>
                {blocksInUse.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.variety')}</label>
            <Select value={filterVariety} onValueChange={setFilterVariety}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('estimacionCosecha.plan.allVarieties')}</SelectItem>
                {varietiesInUse.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {planRows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <CalendarRange className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground mb-1">{t('estimacionCosecha.plan.emptyTitle')}</p>
          <p className="text-sm mb-4 max-w-md mx-auto">
            {t('estimacionCosecha.plan.emptyDesc')}
          </p>
          {!embedded && (
            <Button asChild>
              <Link href="/dashboard/estimacion-cosecha?tab=estimacion">{t('estimacionCosecha.plan.goToEstimation')}</Link>
            </Button>
          )}
          {embedded && (
            <p className="text-xs text-muted-foreground">
              {t('estimacionCosecha.plan.embeddedHint')}
            </p>
          )}
        </div>
      ) : (
        <>
          <HarvestPlanSummary {...summary} />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <HarvestPlanGantt rows={planRows} />
            </div>
            <HarvestPlanWeekBuckets rows={planRows} />
          </div>

          <div className="md:hidden space-y-3">
            {planRows.map((row) => (
              <div key={`${row.label}-${row.window_start}`} className="rounded-xl border p-4 bg-card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.block_name} · {row.variety}</p>
                    <p className="text-xs text-muted-foreground">{row.field_name}</p>
                  </div>
                  <p className="text-sm font-semibold text-primary tabular-nums">{formatKg(row.estimated_kg)}</p>
                </div>
                <p className="text-sm">{formatWindowRange(row.window_start, row.window_end)}</p>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-xs">
                    {row.source === 'manual'
                      ? t('estimacionCosecha.plan.sourceManual')
                      : row.source === 'count'
                        ? t('estimacionCosecha.plan.sourceCount')
                        : t('estimacionCosecha.plan.sourceVariety')}
                  </Badge>
                  {row.id && (
                    <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => openEdit(row)}>
                      <Pencil className="w-3.5 h-3.5" /> {t('estimacionCosecha.plan.dates')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <HarvestPlanTable rows={planRows} onEdit={openEdit} />

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            {t('estimacionCosecha.plan.footnotePrefix')}{' '}
            <Link href="/dashboard/estimacion-cosecha?tab=conteo" className="text-primary hover:underline">{t('estimacionCosecha.plan.countLink')}</Link>
            {' '}{t('estimacionCosecha.plan.footnoteSuffix')}
          </p>
        </>
      )}

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('estimacionCosecha.plan.windowTitle')}</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {editRow.block_name} · {editRow.variety} — {formatKg(editRow.estimated_kg)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t('estimacionCosecha.plan.start')}</label>
                  <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t('estimacionCosecha.plan.end')}</label>
                  <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>{t('common.actions.cancel')}</Button>
            <Button onClick={saveWindow} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('estimacionCosecha.plan.saveDates')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
