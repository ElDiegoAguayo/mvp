export type OfflineTable =
  | 'harvest_fields'
  | 'harvest_blocks'
  | 'harvest_estimates'
  | 'phenology_observations'
  | 'phenology_stages'
  | 'phenology_observation_images'

export type OutboxOperation = 'insert' | 'update' | 'upsert' | 'delete'

export type OutboxStatus = 'pending' | 'processing' | 'failed'

export interface OutboxItem {
  id: string
  userId: string
  table: OfflineTable
  operation: OutboxOperation
  payload: Record<string, unknown>
  /** For update/delete — column filters */
  match?: Record<string, unknown>
  /** Client-generated id for optimistic UI */
  localRecordId?: string
  /** Wait until this local id is synced (server id resolved) */
  dependsOnLocalId?: string
  onConflict?: string
  createdAt: number
  retries: number
  lastError?: string
  status: OutboxStatus
}

export interface PendingFile {
  id: string
  userId: string
  observationLocalId: string
  outboxId: string
  fileName: string
  mimeType: string
  fileSize: number
  sortOrder: number
  blob: Blob
  createdAt: number
}

export interface CatalogCacheEntry {
  key: string
  userId: string
  module: 'harvest' | 'phenology'
  data: unknown
  updatedAt: number
}

export interface LocalIdMapping {
  localId: string
  serverId: string
  table: OfflineTable
  userId: string
  createdAt: number
}

export interface OfflineWriteResult {
  ok: boolean
  offline?: boolean
  localRecordId?: string
  error?: string
}

export const OFFLINE_LOCAL_PREFIX = 'local-'

export function isLocalRecordId(id: string | undefined | null): boolean {
  return !!id && id.startsWith(OFFLINE_LOCAL_PREFIX)
}

export function generateLocalId(): string {
  return `${OFFLINE_LOCAL_PREFIX}${crypto.randomUUID()}`
}

export const OFFLINE_EVENT = {
  pendingChanged: 'upcrop:offline-pending-changed',
  syncStart: 'upcrop:offline-sync-start',
  syncDone: 'upcrop:offline-sync-done',
} as const
