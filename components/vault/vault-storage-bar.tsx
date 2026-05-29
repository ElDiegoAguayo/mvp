'use client'

import { HardDrive } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  formatAvailableStorage,
  formatQuotaLimit,
  formatStorageBytes,
  formatStorageUsageLabel,
  storageBarTone,
  storageUsagePercent,
} from '@/lib/vault-storage'
import type { ClientStorageModule } from '@/lib/client-storage'
import { formatModuleStorageLine } from '@/lib/client-storage'

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
  const percent = storageUsagePercent(usedBytes, quotaBytes)
  const tone = storageBarTone(percent)
  const visibleModules = (modules ?? []).filter((m) => m.bytes > 0 || m.files > 0)

  const barClass =
    tone === 'critical'
      ? '[&_[data-slot=progress-indicator]]:bg-red-500'
      : tone === 'warning'
        ? '[&_[data-slot=progress-indicator]]:bg-amber-500'
        : ''

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <HardDrive className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Almacenamiento</p>
            {!compact && (
              <p className="text-xs text-muted-foreground">
                Cuota compartida de tu empresa en todos los módulos
              </p>
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
        <span>{formatStorageUsageLabel(usedBytes, quotaBytes)}</span>
        <span>{formatAvailableStorage(usedBytes, quotaBytes)} disponibles</span>
      </div>

      {visibleModules.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Uso por módulo
          </p>
          {visibleModules.map((mod) => {
            const modPct = usedBytes > 0 ? Math.max(1, Math.round((mod.bytes / usedBytes) * 100)) : 0
            return (
              <div key={mod.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-foreground truncate">{mod.label}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatModuleStorageLine(mod)}
                  {usedBytes > 0 && mod.bytes > 0 && (
                    <span className="ml-1 text-muted-foreground/70">({modPct}%)</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {tone === 'critical' && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          Cuota casi agotada. Elimina archivos o contacta a soporte para ampliar tu plan.
        </p>
      )}
      {tone === 'warning' && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Estás cerca del límite de almacenamiento de tu plan.
        </p>
      )}
    </div>
  )
}

/** @deprecated Usar ClientStorageBar */
export function VaultStorageBar(props: Omit<ClientStorageBarProps, 'modules'>) {
  return <ClientStorageBar {...props} />
}
