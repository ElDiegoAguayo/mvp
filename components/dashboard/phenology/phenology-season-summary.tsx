'use client'

import type { PhenologyAlert } from '@/lib/agronomy/phenology-predictions'
import { Camera, CalendarClock, AlertCircle, Sprout } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

interface PhenologySeasonSummaryProps {
  blockCount: number
  readingCount: number
  photoCount: number
  alerts: PhenologyAlert[]
  harvestHintCount: number
}

export function PhenologySeasonSummary({
  blockCount,
  readingCount,
  photoCount,
  alerts,
  harvestHintCount,
}: PhenologySeasonSummaryProps) {
  const { t } = useLocale()

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Sprout className="w-3.5 h-3.5" /> {t('estadosFenologicos.summary.blocks')}</p>
          <p className="text-lg font-semibold">{blockCount}</p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {t('estadosFenologicos.summary.readings')}</p>
          <p className="text-lg font-semibold">{readingCount}</p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> {t('estadosFenologicos.summary.photos')}</p>
          <p className="text-lg font-semibold">{photoCount}</p>
        </div>
      </div>

      {harvestHintCount > 0 && (
        <p className="text-xs rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-foreground">
          {t('estadosFenologicos.summary.harvestHint', { count: harvestHintCount })}
        </p>
      )}

      {alerts.length > 0 && (
        <ul className="space-y-1.5">
          {alerts.map((alert, idx) => (
            <li key={`${alert.type}-${alert.block_name}-${idx}`} className="text-xs text-muted-foreground flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>{alert.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
