'use client'

import { HardDrive } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/i18n/locale-provider'
import { translateStorageFilesLabel, translateClientStorageModule } from '@/lib/i18n/translate'
import {
  formatAvailableStorage,
  formatQuotaLimit,
  formatStorageBytes,
  formatQuotaSharePercent,
  storageBarTone,
  storageUsagePercent,
} from '@/lib/vault-storage'
import type { ClientStorageModule } from '@/lib/client-storage'

const STORAGE_MODULE_SLUGS: Record<string, string> = {
  boveda: 'boveda-documental',
  fenologia: 'estados-fenologicos',
}

interface ClientStorageBarProps {
  usedBytes: number
  quotaBytes: number
  modules?: ClientStorageModule[]
  className?: string
  compact?: boolean
}

export function ClientStorageBar({
  usedBytes,
  quotaBytes,
  modules,
  className,
  compact = false,
}: ClientStorageBarProps) {
  const { locale, t, tModule } = useLocale()
  const percent = storageUsagePercent(usedBytes, quotaBytes)
  const tone = storageBarTone(percent)
  const visibleModules = (modules ?? []).filter((m) => m.bytes > 0 || m.files > 0)

  const usedLabel =
    quotaBytes <= 0 || usedBytes <= 0
      ? `0% ${t('storage.usedSuffix')}`
      : `${formatQuotaSharePercent(usedBytes, quotaBytes)} ${t('storage.usedSuffix')}`

  const barClass =
    tone === 'critical'
      ? '[&_[data-slot=progress-indicator]]:bg-red-500'
      : tone === 'warning'
        ? '[&_[data-slot=progress-indicator]]:bg-amber-500'
        : ''

  function formatModuleLine(mod: ClientStorageModule): string {
    const filesLabel = translateStorageFilesLabel(locale, mod.files)
    return `${formatStorageBytes(mod.bytes)} · ${filesLabel}`
  }

  function moduleLabel(mod: ClientStorageModule): string {
    const slug = STORAGE_MODULE_SLUGS[mod.id]
    if (slug) return tModule(slug, mod.label)
    return translateClientStorageModule(mod.id, locale, mod.label)
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <HardDrive className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t('storage.title')}</p>
            {!compact && (
              <p className="text-xs text-muted-foreground">{t('storage.subtitle')}</p>
            )}
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
          {formatStorageBytes(usedBytes)}
          <span className="text-muted-foreground font-normal"> / {formatQuotaLimit(quotaBytes)}</span>
        </p>
      </div>
      <Progress value={percent} className={cn('h-2', barClass)} />
      <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
        <span>{usedLabel}</span>
        <span>
          {formatAvailableStorage(usedBytes, quotaBytes)} {t('storage.available')}
        </span>
      </div>

      {visibleModules.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('storage.usedByModule')}
          </p>
          {visibleModules.map((mod) => {
            const modPctLabel =
              mod.bytes > 0 && quotaBytes > 0
                ? formatQuotaSharePercent(mod.bytes, quotaBytes)
                : null
            return (
              <div key={mod.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-foreground truncate">{moduleLabel(mod)}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatModuleLine(mod)}
                  {modPctLabel && (
                    <span className="ml-1 text-muted-foreground/70">({modPctLabel})</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {tone === 'critical' && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t('storage.quotaAlmostFull')}</p>
      )}
      {tone === 'warning' && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{t('storage.quotaNearLimit')}</p>
      )}
    </div>
  )
}

/** @deprecated Usar ClientStorageBar */
export function VaultStorageBar(props: ClientStorageBarProps) {
  return <ClientStorageBar {...props} />
}
