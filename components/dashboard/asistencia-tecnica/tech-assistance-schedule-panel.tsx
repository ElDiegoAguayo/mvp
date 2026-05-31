'use client'

import { Clock } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { formatEntryTime } from '@/lib/tech-assistance/planilla-format'
import {
  computeWorkHoursFromTimestamps,
  formatHoursValue,
  STANDARD_REGULAR_HOURS,
} from '@/lib/tech-assistance/work-hours'
import { cn } from '@/lib/utils'

interface TechAssistanceSchedulePanelProps {
  startedAt: string | null | undefined
  endedAt: string | null | undefined
  className?: string
}

export function TechAssistanceSchedulePanel({
  startedAt,
  endedAt,
  className,
}: TechAssistanceSchedulePanelProps) {
  const { t, locale } = useLocale()
  const hasCheckIn = Boolean(startedAt)
  const hasCheckOut = Boolean(endedAt)
  const breakdown = computeWorkHoursFromTimestamps(startedAt, endedAt)

  if (!hasCheckIn && !hasCheckOut) return null

  return (
    <div
      className={cn(
        'rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 space-y-3',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock className="h-4 w-4 text-primary" />
        {t('asistenciaTecnica.schedule.title')}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.correction.checkInLabel')}</p>
          <p className="font-medium tabular-nums">
            {hasCheckIn ? formatEntryTime(startedAt, locale) : t('asistenciaTecnica.schedule.pending')}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.correction.checkOutLabel')}</p>
          <p className="font-medium tabular-nums">
            {hasCheckOut ? formatEntryTime(endedAt, locale) : t('asistenciaTecnica.schedule.pendingCheckout')}
          </p>
        </div>
      </div>

      {breakdown ? (
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.schedule.totalWorked')}</p>
            <p className="font-semibold tabular-nums text-foreground">
              {formatHoursValue(breakdown.totalHours, locale)} {t('asistenciaTecnica.schedule.hoursUnit')}
            </p>
          </div>
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.correction.regularHours')}</p>
            <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatHoursValue(breakdown.regularHours, locale)} {t('asistenciaTecnica.schedule.hoursUnit')}
            </p>
          </div>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.correction.overtimeHours')}</p>
            <p className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {formatHoursValue(breakdown.overtimeHours, locale)} {t('asistenciaTecnica.schedule.hoursUnit')}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.schedule.checkoutHint')}</p>
      )}

      {breakdown && (
        <p className="text-[11px] text-muted-foreground">
          {t('asistenciaTecnica.schedule.computedNote', { hours: STANDARD_REGULAR_HOURS })}
        </p>
      )}
    </div>
  )
}
