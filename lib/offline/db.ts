import Dexie, { type Table } from 'dexie'
import type {
  CatalogCacheEntry,
  LocalIdMapping,
  OutboxItem,
  PendingFile,
} from './types'

class UpCropOfflineDB extends Dexie {
  outbox!: Table<OutboxItem, string>
  catalogCache!: Table<CatalogCacheEntry, string>
  pendingFiles!: Table<PendingFile, string>
  idMappings!: Table<LocalIdMapping, string>

  constructor() {
    super('upcrop-offline')
    this.version(1).stores({
      outbox: 'id, userId, status, createdAt, localRecordId, dependsOnLocalId',
      catalogCache: 'key, userId, module, updatedAt',
      pendingFiles: 'id, userId, observationLocalId, outboxId',
      idMappings: 'localId, serverId, userId, table',
    })
  }
}

let dbInstance: UpCropOfflineDB | null = null

export function getOfflineDb(): UpCropOfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser')
  }
  if (!dbInstance) {
    dbInstance = new UpCropOfflineDB()
  }
  return dbInstance
}
