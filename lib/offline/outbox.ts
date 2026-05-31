import { getOfflineDb } from './db'
import { emitOfflinePendingChanged } from './events'
import type { OutboxItem, OutboxOperation, OfflineTable } from './types'
import { generateLocalId } from './types'

export async function countPendingOutbox(userId?: string): Promise<number> {
  const db = getOfflineDb()
  const items = userId
    ? await db.outbox.where('userId').equals(userId).toArray()
    : await db.outbox.toArray()
  return items.filter((i) => i.status === 'pending' || i.status === 'failed').length
}

interface QueueOptions {
  userId: string
  table: OfflineTable
  operation: OutboxOperation
  payload: Record<string, unknown>
  match?: Record<string, unknown>
  localRecordId?: string
  dependsOnLocalId?: string
  onConflict?: string
}

export async function queueOutboxItem(options: QueueOptions): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    userId: options.userId,
    table: options.table,
    operation: options.operation,
    payload: options.payload,
    match: options.match,
    localRecordId: options.localRecordId ?? generateLocalId(),
    dependsOnLocalId: options.dependsOnLocalId,
    onConflict: options.onConflict,
    createdAt: Date.now(),
    retries: 0,
    status: 'pending',
  }

  await getOfflineDb().outbox.add(item)
  emitOfflinePendingChanged()
  return item
}

export async function getPendingOutboxItems(userId?: string): Promise<OutboxItem[]> {
  const db = getOfflineDb()
  const items = userId
    ? await db.outbox.where('userId').equals(userId).toArray()
    : await db.outbox.toArray()
  return items
    .filter((i) => i.status === 'pending' || i.status === 'failed')
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function removeOutboxItem(id: string): Promise<void> {
  await getOfflineDb().outbox.delete(id)
  emitOfflinePendingChanged()
}

export async function markOutboxFailed(id: string, error: string): Promise<void> {
  const db = getOfflineDb()
  const item = await db.outbox.get(id)
  if (!item) return
  await db.outbox.update(id, {
    status: 'failed',
    lastError: error,
    retries: item.retries + 1,
  })
  emitOfflinePendingChanged()
}

export async function resetOutboxToPending(id: string): Promise<void> {
  await getOfflineDb().outbox.update(id, {
    status: 'pending',
    lastError: undefined,
  })
  emitOfflinePendingChanged()
}

export async function resetAllFailedToPending(userId?: string): Promise<void> {
  const db = getOfflineDb()
  const items = userId
    ? await db.outbox.where('userId').equals(userId).toArray()
    : await db.outbox.toArray()
  const failed = items.filter((i) => i.status === 'failed')
  for (const item of failed) {
    await db.outbox.update(item.id, { status: 'pending', lastError: undefined })
  }
  if (failed.length > 0) emitOfflinePendingChanged()
}

export async function discardOutboxItem(id: string): Promise<void> {
  const db = getOfflineDb()
  const item = await db.outbox.get(id)
  if (!item) return
  await db.outbox.delete(id)
  if (item.localRecordId) {
    await db.pendingFiles.where('observationLocalId').equals(item.localRecordId).delete()
  }
  emitOfflinePendingChanged()
}

export async function countPendingFiles(userId?: string): Promise<number> {
  const db = getOfflineDb()
  if (userId) {
    return db.pendingFiles.where('userId').equals(userId).count()
  }
  return db.pendingFiles.count()
}

export async function saveIdMapping(
  localId: string,
  serverId: string,
  table: OfflineTable,
  userId: string,
): Promise<void> {
  await getOfflineDb().idMappings.put({
    localId,
    serverId,
    table,
    userId,
    createdAt: Date.now(),
  })
}

export async function resolveLocalId(localId: string): Promise<string | null> {
  const mapping = await getOfflineDb().idMappings.get(localId)
  return mapping?.serverId ?? null
}

export async function addPendingFiles(
  files: Array<{
    userId: string
    observationLocalId: string
    outboxId: string
    file: File
    sortOrder: number
  }>,
): Promise<void> {
  const db = getOfflineDb()
  for (const f of files) {
    await db.pendingFiles.add({
      id: crypto.randomUUID(),
      userId: f.userId,
      observationLocalId: f.observationLocalId,
      outboxId: f.outboxId,
      fileName: f.file.name,
      mimeType: f.file.type || 'application/octet-stream',
      fileSize: f.file.size,
      sortOrder: f.sortOrder,
      blob: f.file,
      createdAt: Date.now(),
    })
  }
  emitOfflinePendingChanged()
}

export async function getPendingFilesForObservation(observationLocalId: string) {
  return getOfflineDb().pendingFiles
    .where('observationLocalId')
    .equals(observationLocalId)
    .sortBy('sortOrder')
}

export async function removePendingFiles(ids: string[]): Promise<void> {
  await getOfflineDb().pendingFiles.bulkDelete(ids)
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
}

export { sanitizeFileName }
