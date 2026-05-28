'use client'

import { formatKg } from '@/lib/agronomy/format'
import { formatWindowRange, type HarvestPlanRow } from '@/lib/agronomy/harvest-plan-windows'

interface HarvestPlanSummaryProps {
  totalKg: number
  blockCount: number
  fieldCount: number
  manualCount: number
  phenologyCount: number
  earliestStart: string | null
  latestEnd: string | null
}

export function HarvestPlanSummary({
  totalKg,
  blockCount,
  fieldCount,
  manualCount,
  phenologyCount,
  earliestStart,
  latestEnd,
}: HarvestPlanSummaryProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border bg-gradient-to-br from-amber-500/10 via-card to-card p-4">
        <p className="text-xs text-muted-foreground mb-1">Kg en plan</p>
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatKg(totalKg)}</p>
        <p className="text-xs text-muted-foreground mt-1">{blockCount} cuartel{blockCount === 1 ? '' : 'es'}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-1">Campos</p>
        <p className="text-2xl font-bold tabular-nums">{fieldCount}</p>
        <p className="text-xs text-muted-foreground mt-1">Con ventana asignada</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-1">Origen de fechas</p>
        <p className="text-sm font-medium mt-1">
          {manualCount} manual · {phenologyCount} fenología
        </p>
        <p className="text-xs text-muted-foreground mt-1">Resto por referencia de variedad</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-1">Rango temporada</p>
        <p className="text-sm font-semibold mt-1">
          {earliestStart && latestEnd
            ? formatWindowRange(earliestStart, latestEnd)
            : '—'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Primera apertura → último cierre</p>
      </div>
    </div>
  )
}

export function HarvestPlanWeekBuckets({ rows }: { rows: HarvestPlanRow[] }) {
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

  return (
    <div className="rounded-xl border p-4 bg-card">
      <p className="font-medium text-sm mb-1">Carga estimada por mes</p>
      <p className="text-xs text-muted-foreground mb-4">Suma de kg por inicio de ventana</p>
      <div className="space-y-2">
        {sorted.map(([monthKey, data]) => {
          const [y, m] = monthKey.split('-')
          const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
          const label = `${monthNames[Number(m) - 1] ?? m} ${y}`
          const pct = maxKg > 0 ? Math.round((data.kg / maxKg) * 100) : 0
          return (
            <div key={monthKey} className="grid grid-cols-[72px_1fr_80px] gap-3 items-center text-sm">
              <span className="text-muted-foreground text-xs">{label}</span>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500/80"
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
