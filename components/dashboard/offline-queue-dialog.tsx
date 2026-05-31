'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Trash2, Download } from 'lucide-react'
import { useOffline } from '@/components/dashboard/offline-provider'
import { outboxItemLabel, outboxItemMeta } from '@/lib/offline/outbox-labels'
import type { OutboxItem } from '@/lib/offline/types'
import { getPendingOutboxItems, discardOutboxItem, countPendingFiles } from '@/lib/offline/outbox'
import { toast } from 'sonner'
import { useLocale } from '@/components/i18n/locale-provider'

interface OfflineQueueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
}

export function OfflineQueueDialog({ open, onOpenChange, userId }: OfflineQueueDialogProps) {
  const { syncNow, isSyncing, isOnline, prepareForField, isPreparing } = useOffline()
  const { t, locale } = useLocale()
  const [items, setItems] = useState<OutboxItem[]>([])
  const [photoCount, setPhotoCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [outbox, photos] = await Promise.all([
        getPendingOutboxItems(userId),
        countPendingFiles(userId),
      ])
      setItems(outbox)
      setPhotoCount(photos)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  async function handleDiscard(id: string) {
    if (!confirm(t('offline.queue.discardConfirm'))) return
    await discardOutboxItem(id)
    toast.success(t('offline.queue.discarded'))
    await reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('offline.queue.title')}</DialogTitle>
          <DialogDescription>
            {t('offline.queue.description')}
          </DialogDescription>
        </DialogHeader>

        {isOnline && (
          <div className="flex flex-wrap gap-2 pb-2 border-b">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPreparing}
              onClick={() => void prepareForField({ silent: false })}
              className="gap-1.5"
            >
              {isPreparing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {t('offline.queue.prepareField')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSyncing || items.length === 0}
              onClick={() => void syncNow().then(() => reload())}
              className="gap-1.5"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {t('offline.queue.syncAll')}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 py-1">
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : items.length === 0 && photoCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('offline.queue.noPending')}
            </p>
          ) : (
            <>
              {photoCount > 0 && (
                <p className="text-xs text-muted-foreground px-1">
                  {photoCount === 1
                    ? t('offline.queue.photosQueued', { count: photoCount })
                    : t('offline.queue.photosQueuedPlural', { count: photoCount })}
                </p>
              )}
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border px-3 py-2.5 bg-muted/20"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{outboxItemLabel(item, locale)}</p>
                    <p className="text-xs text-muted-foreground truncate">{outboxItemMeta(item, locale)}</p>
                  </div>
                  {item.status === 'failed' && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      {t('offline.outbox.error')}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    title={t('offline.queue.discard')}
                    onClick={() => void handleDiscard(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
