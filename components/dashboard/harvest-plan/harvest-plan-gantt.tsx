'use client'

import { useMemo } from 'react'
import { formatKg } from '@/lib/agronomy/format'
import {
  barPosition,
  computeTimelineRange,
  daysBetween,
  formatWindowRange,
  type HarvestPlanRow,
  type HarvestWindowSource,
} from '@/lib/agronomy/harvest-plan-windows'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/i18n/locale-provider'

const SOURCE_STYLE = {
  manual: 'bg-emerald-500/80 border-emerald-400',
  count: 'bg-amber-500/80 border-amber-400',
  variety: 'bg-sky-500/70 border-sky-400',
} as const

function monthTicks(
  rangeStart: string,
  rangeEnd: string,
  dateLocale: string,
): Array<{ label: string; leftPct: number }> {
  const start = new Date(rangeStart + 'T12:00:00')
  const end = new Date(rangeEnd + 'T12:00:00')
  const totalDays = daysBetween(rangeStart, rangeEnd)
  const ticks: Array<{ label: string; leftPct: number }> = []

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10)
    const offset = daysBetween(rangeStart, iso) - 1
    ticks.push({
      label: cursor.toLocaleDateString(dateLocale, { month: 'short', year: 'numeric' }),
      leftPct: Math.max(0, Math.min(100, (offset / totalDays) * 100)),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return ticks
}

function sourceLabel(t: (key: string) => string, source: HarvestWindowSource) {
  if (source === 'manual') return t('estimacionCosecha.plan.sourceManual')
  if (source === 'count') return t('estimacionCosecha.plan.sourceCount')
  return t('estimacionCosecha.plan.sourceVariety')
}

interface HarvestPlanGanttProps {
  rows: HarvestPlanRow[]
}

export function HarvestPlanGantt({ rows }: HarvestPlanGanttProps) {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const range = useMemo(() => computeTimelineRange(rows), [rows])
  const ticks = useMemo(
    () => (range ? monthTicks(range.start, range.end, dateLocale) : []),
    [range, dateLocale],
  )

  if (rows.length === 0 || !range) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
        {t('estimacionCosecha.plan.noWindows')}
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <div className="px-4 py-3 border-b bg-muted/30">
        <p className="font-medium text-sm">{t('estimacionCosecha.plan.ganttTitle')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('estimacionCosecha.plan.ganttSub')}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px] p-4">
          <div className="relative h-8 border-b border-border/60 mb-3">
            {ticks.map((tick) => (
              <div
                key={tick.label}
                className="absolute top-0 text-[10px] text-muted-foreground whitespace-nowrap -translate-x-1/2"
                style={{ left: `${tick.leftPct}%` }}
              >
                {tick.label}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {rows.map((row) => {
              const { leftPct, widthPct } = barPosition(
                row.window_start,
                row.window_end,
                range.start,
                range.end,
              )
              const maxKg = Math.max(...rows.map((r) => r.estimated_kg))
              const heightPct = Math.max(28, Math.round((row.estimated_kg / maxKg) * 36) + 20)

              return (
                <div key={`${row.label}-${row.window_start}`} className="grid grid-cols-[minmax(140px,220px)_1fr] gap-3 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{row.block_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {row.field_name} · {row.variety}
                    </p>
                    <p className="text-xs tabular-nums text-primary/90 mt-0.5">{formatKg(row.estimated_kg)}</p>
                  </div>
                  <div className="relative h-10 bg-muted/30 rounded-lg overflow-hidden">
                    <div
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 rounded-md border shadow-sm transition-all',
                        SOURCE_STYLE[row.source],
                      )}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}px`,
                      }}
                      title={`${formatWindowRange(row.window_start, row.window_end)} · ${formatKg(row.estimated_kg)}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/60">
            {(Object.keys(SOURCE_STYLE) as Array<keyof typeof SOURCE_STYLE>).map((source) => (
              <div key={source} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('w-3 h-3 rounded-sm border', SOURCE_STYLE[source])} />
                {sourceLabel(t, source)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface HarvestPlanTableProps {
  rows: HarvestPlanRow[]
  onEdit?: (row: HarvestPlanRow) => void
}

export function HarvestPlanTable({ rows, onEdit }: HarvestPlanTableProps) {
  const { t } = useLocale()

  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border overflow-hidden hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.field')}</th>
              <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.block')}</th>
              <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.variety')}</th>
              <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.estimatedKg')}</th>
              <th className="px-3 py-3 font-medium">{t('estimacionCosecha.plan.tableStart')}</th>
              <th className="px-3 py-3 font-medium">{t('estimacionCosecha.plan.tableEnd')}</th>
              <th className="px-3 py-3 font-medium">{t('estimacionCosecha.plan.tableOrigin')}</th>
              <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.count')}</th>
              {onEdit && <th className="px-3 py-3 w-20" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.label}-${row.window_start}`} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-3 text-muted-foreground">{row.field_name}</td>
                <td className="px-3 py-3 font-medium">{row.block_name}</td>
                <td className="px-3 py-3">{row.variety}</td>
                <td className="px-3 py-3 tabular-nums font-medium">{formatKg(row.estimated_kg)}</td>
                <td className="px-3 py-3 tabular-nums">{row.window_start.split('-').reverse().join('/')}</td>
                <td className="px-3 py-3 tabular-nums">{row.window_end.split('-').reverse().join('/')}</td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className="text-xs font-normal">
                    {sourceLabel(t, row.source)}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-muted-foreground text-xs">{row.count_label ?? '—'}</td>
                {onEdit && (
                  <td className="px-3 py-3">
                    {row.id && !row.id.startsWith('computed-') && (
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('common.actions.edit')}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
