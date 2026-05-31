'use client'

import { formatKg } from '@/lib/agronomy/format'
import { formatWindowRange, type HarvestPlanRow } from '@/lib/agronomy/harvest-plan-windows'
import { useLocale } from '@/components/i18n/locale-provider'

interface HarvestPlanSummaryProps {
  totalKg: number
  blockCount: number
  fieldCount: number
  manualCount: number
  countSourceCount: number
  earliestStart: string | null
  latestEnd: string | null
}

export function HarvestPlanSummary({
  totalKg,
  blockCount,
  fieldCount,
  manualCount,
  countSourceCount,
  earliestStart,
  latestEnd,
}: HarvestPlanSummaryProps) {
  const { t } = useLocale()

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4">
        <p className="text-xs text-muted-foreground mb-1">{t('estimacionCosecha.plan.kgInPlan')}</p>
        <p className="text-2xl font-bold text-primary tabular-nums">{formatKg(totalKg)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {blockCount === 1
            ? t('estimacionCosecha.plan.blocksCount', { count: blockCount })
            : t('estimacionCosecha.plan.blocksCountPlural', { count: blockCount })}
        </p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-1">{t('estimacionCosecha.plan.fields')}</p>
        <p className="text-2xl font-bold tabular-nums">{fieldCount}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('estimacionCosecha.plan.withWindow')}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-1">{t('estimacionCosecha.plan.dateOrigin')}</p>
        <p className="text-sm font-medium mt-1">
          {t('estimacionCosecha.plan.manualCount', { manual: manualCount, count: countSourceCount })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{t('estimacionCosecha.plan.varietyReference')}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-1">{t('estimacionCosecha.plan.seasonRange')}</p>
        <p className="text-sm font-semibold mt-1">
          {earliestStart && latestEnd
            ? formatWindowRange(earliestStart, latestEnd)
            : '—'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{t('estimacionCosecha.plan.firstToLast')}</p>
      </div>
    </div>
  )
}

export function HarvestPlanWeekBuckets({ rows }: { rows: HarvestPlanRow[] }) {
  const { t, locale } = useLocale()
  const buckets = new Map<string, { kg: number; blocks: Set<string> }>()

  for (const row of rows) {
    const weekKey = row.window_start.slice(0, 7)
    const entry = buckets.get(weekKey) ?? { kg: 0, blocks: new Set<string>() }
    entry.kg += row.estimated_kg
    entry.blocks.add(row.block_name)
    buckets.set(weekKey, entry)
  }

  const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))

  if (sorted.length === 0) return null

  const maxKg = Math.max(...sorted.map(([, v]) => v.kg))
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'

  return (
    <div className="rounded-xl border p-4 bg-card">
      <p className="font-medium text-sm mb-1">{t('estimacionCosecha.plan.loadByMonth')}</p>
      <p className="text-xs text-muted-foreground mb-4">{t('estimacionCosecha.plan.loadByMonthSub')}</p>
      <div className="space-y-2">
        {sorted.map(([monthKey, data]) => {
          const [y, m] = monthKey.split('-')
          const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(dateLocale, {
            month: 'short',
            year: 'numeric',
          })
          const pct = maxKg > 0 ? Math.round((data.kg / maxKg) * 100) : 0
          return (
            <div key={monthKey} className="grid grid-cols-[72px_1fr_80px] gap-3 items-center text-sm">
              <span className="text-muted-foreground text-xs">{label}</span>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/80"
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-right">{formatKg(data.kg)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
