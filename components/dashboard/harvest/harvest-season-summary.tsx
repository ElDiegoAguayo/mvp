'use client'

import { formatKg } from '@/lib/agronomy/format'
import { BarChart3, CalendarDays, AlertTriangle, Database, Calculator } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

interface HarvestSeasonSummaryProps {
  totalKg: number
  missingHaCount: number
  lastRecordDate: string | null
  computedCount: number
  savedCount: number
}

export function HarvestSeasonSummary({
  totalKg,
  missingHaCount,
  lastRecordDate,
  computedCount,
  savedCount,
}: HarvestSeasonSummaryProps) {
  const { t } = useLocale()

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-card p-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> {t('estimacionCosecha.summary.estimatedKg')}
          </p>
          <p className="text-2xl font-bold text-primary">{formatKg(totalKg)}</p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" /> {t('estimacionCosecha.summary.lastRecord')}
          </p>
          <p className="text-sm font-semibold">{lastRecordDate ?? '—'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
          <Database className="w-3 h-3" /> {t('estimacionCosecha.summary.savedCount', { count: savedCount })}
        </span>
        {computedCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
            <Calculator className="w-3 h-3" /> {t('estimacionCosecha.summary.computedOnly', { count: computedCount })}
          </span>
        )}
        {missingHaCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> {t('estimacionCosecha.summary.missingHa', { count: missingHaCount })}
          </span>
        )}
      </div>
    </div>
  )
}
