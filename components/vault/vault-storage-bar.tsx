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

interface VaultStorageBarProps {
  usedBytes: number
  quotaBytes: number
  className?: string
  compact?: boolean
}

export function VaultStorageBar({
  usedBytes,
  quotaBytes,
  className,
  compact = false,
}: VaultStorageBarProps) {
  const percent = storageUsagePercent(usedBytes, quotaBytes)
  const tone = storageBarTone(percent)

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
                Espacio compartido de tu empresa en Mis documentos
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
