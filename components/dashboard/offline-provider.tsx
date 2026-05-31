'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  countPendingOutbox,
  getPendingOutboxItems,
} from '@/lib/offline/outbox'
import { syncOfflineQueue } from '@/lib/offline/sync-engine'
import { OFFLINE_EVENT } from '@/lib/offline/types'
import { isBrowserOnline } from '@/lib/offline/network'
import { collectPendingRecordIds } from '@/lib/offline/pending-records'
import { prepareFieldCache } from '@/lib/offline/prepare-field'
import { toast } from 'sonner'
import { useLocale } from '@/components/i18n/locale-provider'

interface OfflineContextValue {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  isPreparing: boolean
  /** True when offline or hay cola — habilita badges y banner */
  showOfflineUi: boolean
  pendingRecordIds: Set<string>
  syncNow: () => Promise<void>
  refreshPendingCount: () => Promise<void>
  prepareForField: (options?: { silent?: boolean }) => Promise<void>
}

const OfflineContext = createContext<OfflineContextValue | null>(null)

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext)
  if (!ctx) {
    return {
      isOnline: true,
      pendingCount: 0,
      isSyncing: false,
      isPreparing: false,
      showOfflineUi: false,
      pendingRecordIds: new Set(),
      syncNow: async () => {},
      refreshPendingCount: async () => {},
      prepareForField: async () => {},
    }
  }
  return ctx
}

interface OfflineProviderProps {
  children: ReactNode
  userId?: string
}

export function OfflineProvider({ children, userId }: OfflineProviderProps) {
  const supabase = useMemo(() => createClient(), [])
  const { t } = useLocale()
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingRecordIds, setPendingRecordIds] = useState<Set<string>>(new Set())
  const [isSyncing, setIsSyncing] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)

  const refreshPendingCount = useCallback(async () => {
    try {
      const items = await getPendingOutboxItems(userId)
      setPendingCount(items.length)
      setPendingRecordIds(collectPendingRecordIds(items))
    } catch {
      setPendingCount(0)
      setPendingRecordIds(new Set())
    }
  }, [userId])

  const syncNow = useCallback(async () => {
    if (!isBrowserOnline()) return
    setIsSyncing(true)
    try {
      const { synced, failed } = await syncOfflineQueue(supabase, userId)
      await refreshPendingCount()
      if (synced > 0) {
        toast.success(
          synced === 1
            ? t('offline.provider.synced', { count: synced })
            : t('offline.provider.syncedPlural', { count: synced }),
        )
      }
      if (failed > 0) {
        toast.error(
          failed === 1
            ? t('offline.provider.syncFailed', { count: failed })
            : t('offline.provider.syncFailedPlural', { count: failed }),
          {
            description: t('offline.provider.syncFailedDesc'),
          },
        )
      }
    } finally {
      setIsSyncing(false)
    }
  }, [supabase, userId, refreshPendingCount, t])

  const prepareForField = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId || !isBrowserOnline()) {
        if (!options?.silent) {
          toast.error(t('offline.provider.connectToPrepare'))
        }
        return
      }
      setIsPreparing(true)
      try {
        await prepareFieldCache(supabase, userId)
        if (!options?.silent) {
          toast.success(t('offline.provider.fieldReady'))
        }
      } catch {
        if (!options?.silent) {
          toast.error(t('offline.provider.prepareFailed'))
        }
      } finally {
        setIsPreparing(false)
      }
    },
    [supabase, userId, t],
  )

  useEffect(() => {
    setIsOnline(isBrowserOnline())

    const onOnline = () => {
      setIsOnline(true)
      void syncNow()
    }
    const onOffline = () => setIsOnline(false)
    const onPending = () => void refreshPendingCount()
    const onSyncStart = () => setIsSyncing(true)
    const onSyncDone = () => {
      setIsSyncing(false)
      void refreshPendingCount()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener(OFFLINE_EVENT.pendingChanged, onPending)
    window.addEventListener(OFFLINE_EVENT.syncStart, onSyncStart)
    window.addEventListener(OFFLINE_EVENT.syncDone, onSyncDone)

    void refreshPendingCount()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener(OFFLINE_EVENT.pendingChanged, onPending)
      window.removeEventListener(OFFLINE_EVENT.syncStart, onSyncStart)
      window.removeEventListener(OFFLINE_EVENT.syncDone, onSyncDone)
    }
  }, [syncNow, refreshPendingCount])

  // Sincronizar cola pendiente al entrar (ya no se dispara en cada load de módulo)
  useEffect(() => {
    if (!userId || !isOnline) return
    void (async () => {
      const items = await getPendingOutboxItems(userId)
      if (items.length > 0) await syncNow()
    })()
  }, [userId, isOnline, syncNow])

  // Precarga silenciosa al entrar (sin cambiar la UI online)
  useEffect(() => {
    if (!userId || !isOnline) return
    void prepareForField({ silent: true })
    const interval = setInterval(() => {
      if (isBrowserOnline()) void prepareForField({ silent: true })
    }, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [userId, isOnline, prepareForField])

  const showOfflineUi = !isOnline || pendingCount > 0

  const value = useMemo(
    () => ({
      isOnline,
      pendingCount,
      isSyncing,
      isPreparing,
      showOfflineUi,
      pendingRecordIds,
      syncNow,
      refreshPendingCount,
      prepareForField,
    }),
    [
      isOnline,
      pendingCount,
      isSyncing,
      isPreparing,
      showOfflineUi,
      pendingRecordIds,
      syncNow,
      refreshPendingCount,
      prepareForField,
    ],
  )

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
}
