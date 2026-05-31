'use client'

import { useState } from 'react'
import { CloudOff, Loader2, List, RefreshCw, Upload } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { Button } from '@/components/ui/button'
import { useOffline } from '@/components/dashboard/offline-provider'
import { OfflineQueueDialog } from '@/components/dashboard/offline-queue-dialog'

interface OfflineBannerProps {
  userId?: string
}

export function OfflineBanner({ userId }: OfflineBannerProps) {
  const { isOnline, pendingCount, isSyncing, syncNow, showOfflineUi } = useOffline()
  const { t } = useLocale()
  const [queueOpen, setQueueOpen] = useState(false)

  // Online + sincronizado = sin banner (UI idéntica a antes)
  if (!showOfflineUi) return null

  const showOffline = !isOnline
  const showPending = pendingCount > 0

  return (
    <>
      <div
        className={`sticky top-0 z-40 shrink-0 border-b backdrop-blur-sm ${
          showOffline
            ? 'border-sky-500/40 bg-sky-500/15'
            : 'border-emerald-500/40 bg-emerald-500/15'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                showOffline
                  ? 'bg-sky-500/20 border-sky-500/40'
                  : 'bg-emerald-500/20 border-emerald-500/40'
              }`}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-300" />
              ) : showOffline ? (
                <CloudOff className="w-4 h-4 text-sky-700 dark:text-sky-300" />
              ) : (
                <Upload className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
              )}
            </div>
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${
                  showOffline
                    ? 'text-sky-900 dark:text-sky-100'
                    : 'text-emerald-900 dark:text-emerald-100'
                }`}
              >
                {isSyncing
                  ? t('offline.syncingChanges')
                  : showOffline
                    ? t('offline.offlineMode')
                    : t('offline.pendingUpload')}
              </p>
              <p
                className={`text-xs truncate ${
                  showOffline
                    ? 'text-sky-800/90 dark:text-sky-200/90'
                    : 'text-emerald-800/90 dark:text-emerald-200/90'
                }`}
              >
                {showOffline
                  ? t('offline.offlineDeviceDesc')
                  : showPending
                    ? pendingCount === 1
                      ? t('offline.pendingQueue', { count: pendingCount })
                      : t('offline.pendingQueuePlural', { count: pendingCount })
                    : t('offline.connected')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQueueOpen(true)}
              className={`h-8 gap-1.5 bg-background/80 ${
                showOffline
                  ? 'border-sky-500/50 hover:bg-sky-500/10 text-sky-900 dark:text-sky-100'
                  : 'border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              {t('offline.viewPending')}
            </Button>
            {isOnline && showPending && !isSyncing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void syncNow()}
                className="h-8 gap-1.5 border-emerald-500/50 bg-background/80 hover:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('offline.sync')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <OfflineQueueDialog open={queueOpen} onOpenChange={setQueueOpen} userId={userId} />
    </>
  )
}
