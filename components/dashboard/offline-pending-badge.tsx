'use client'

import { Badge } from '@/components/ui/badge'
import { CloudOff } from 'lucide-react'
import { useOffline } from '@/components/dashboard/offline-provider'
import { isRecordPendingSync } from '@/lib/offline/pending-records'

interface OfflinePendingBadgeProps {
  recordId: string
  className?: string
}

/** Solo visible offline o con cambios en cola — no altera la UI en uso online normal. */
export function OfflinePendingBadge({ recordId, className }: OfflinePendingBadgeProps) {
  const { showOfflineUi, pendingRecordIds } = useOffline()

  if (!showOfflineUi) return null
  if (!isRecordPendingSync(recordId, pendingRecordIds)) return null

  return (
    <Badge
      variant="outline"
      className={`bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[10px] shrink-0 ${className ?? ''}`}
    >
      <CloudOff className="w-3 h-3 mr-1" />
      Pendiente
    </Badge>
  )
}
