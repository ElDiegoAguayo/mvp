import { OFFLINE_EVENT } from './types'

export function emitOfflinePendingChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENT.pendingChanged))
}

export function emitOfflineSyncStart() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENT.syncStart))
}

export function emitOfflineSyncDone(detail?: { synced: number; failed: number }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENT.syncDone, { detail }))
}
