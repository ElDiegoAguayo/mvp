import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getPendingOutboxItems,
  removeOutboxItem,
  markOutboxFailed,
  saveIdMapping,
  getPendingFilesForObservation,
  removePendingFiles,
  sanitizeFileName,
  resetAllFailedToPending,
} from './outbox'
import { emitOfflineSyncStart, emitOfflineSyncDone } from './events'
import { isBrowserOnline } from './network'
import type { OutboxItem } from './types'
import { resolveLocalId } from './outbox'

let syncing = false

export function isSyncInProgress(): boolean {
  return syncing
}

async function resolveDependency(localId: string | undefined): Promise<string | null> {
  if (!localId) return null
  return resolveLocalId(localId)
}

async function uploadPendingObservationImages(
  supabase: SupabaseClient,
  userId: string,
  observationLocalId: string,
  serverObservationId: string,
): Promise<void> {
  const files = await getPendingFilesForObservation(observationLocalId)
  if (files.length === 0) return

  const uploadedIds: string[] = []
  for (let i = 0; i < files.length; i++) {
    const pf = files[i]
    const safeName = sanitizeFileName(pf.fileName)
    const storagePath = `${userId}/phenology/${serverObservationId}/${Date.now()}-${i}-${safeName}`

    const { error: upErr } = await supabase.storage
      .from('fenologia')
      .upload(storagePath, pf.blob, { contentType: pf.mimeType, upsert: false })
    if (upErr) throw upErr

    const { error: dbErr } = await supabase.from('phenology_observation_images').insert({
      observation_id: serverObservationId,
      user_id: userId,
      storage_path: storagePath,
      file_name: safeName,
      mime_type: pf.mimeType,
      file_size: pf.fileSize,
      sort_order: pf.sortOrder,
    })
    if (dbErr) throw dbErr
    uploadedIds.push(pf.id)
  }

  await removePendingFiles(uploadedIds)
}

async function executeOutboxItem(
  supabase: SupabaseClient,
  item: OutboxItem,
): Promise<void> {
  const dep = await resolveDependency(item.dependsOnLocalId)
  if (item.dependsOnLocalId && !dep) {
    throw new Error(`Dependencia pendiente: ${item.dependsOnLocalId}`)
  }

  let payload = { ...item.payload }
  if (dep && payload.observation_id && String(payload.observation_id).startsWith('local-')) {
    payload = { ...payload, observation_id: dep }
  }

  switch (item.operation) {
    case 'insert': {
      const { data, error } = await supabase
        .from(item.table)
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error
      if (item.localRecordId && data?.id) {
        await saveIdMapping(item.localRecordId, String(data.id), item.table, item.userId)
      }
      if (item.table === 'phenology_observations') {
        const obsId = item.localRecordId
          ? (await resolveLocalId(item.localRecordId)) ?? String(data?.id)
          : String(item.match?.id ?? data?.id)
        if (obsId) {
          await uploadPendingObservationImages(
            supabase,
            item.userId,
            item.localRecordId ?? obsId,
            obsId,
          )
        }
      }
      break
    }
    case 'update': {
      let query = supabase.from(item.table).update(payload)
      if (item.match) {
        for (const [key, value] of Object.entries(item.match)) {
          query = query.eq(key, value as string)
        }
      }
      const { error } = await query
      if (error) throw error
      if (item.table === 'phenology_observations') {
        const obsId = item.localRecordId
          ? (await resolveLocalId(item.localRecordId)) ?? String(item.match?.id)
          : String(item.match?.id)
        if (obsId) {
          await uploadPendingObservationImages(
            supabase,
            item.userId,
            item.localRecordId ?? obsId,
            obsId,
          )
        }
      }
      break
    }
    case 'upsert': {
      const { data, error } = await supabase
        .from(item.table)
        .upsert(payload, item.onConflict ? { onConflict: item.onConflict } : undefined)
        .select('id')
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      if (item.localRecordId && row?.id) {
        await saveIdMapping(item.localRecordId, String(row.id), item.table, item.userId)
      }
      break
    }
    case 'delete': {
      let query = supabase.from(item.table).delete()
      if (item.match) {
        for (const [key, value] of Object.entries(item.match)) {
          query = query.eq(key, value as string)
        }
      }
      const { error } = await query
      if (error) throw error
      break
    }
    default:
      throw new Error(`Operación no soportada: ${item.operation}`)
  }
}

export async function syncOfflineQueue(
  supabase: SupabaseClient,
  userId?: string,
): Promise<{ synced: number; failed: number }> {
  if (!isBrowserOnline() || syncing) {
    return { synced: 0, failed: 0 }
  }

  const initialPending = await getPendingOutboxItems(userId)
  if (initialPending.length === 0) {
    return { synced: 0, failed: 0 }
  }

  syncing = true
  emitOfflineSyncStart()

  await resetAllFailedToPending(userId)

  let synced = 0
  let failed = 0
  let pass = 0
  const maxPasses = 5

  try {
    while (pass < maxPasses) {
      const items = await getPendingOutboxItems(userId)
      const pending = items.filter((i) => i.status === 'pending' || i.status === 'failed')
      if (pending.length === 0) break

      let progressThisPass = 0
      for (const item of pending) {
        try {
          await executeOutboxItem(supabase, item)
          await removeOutboxItem(item.id)
          synced++
          progressThisPass++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error desconocido'
          if (msg.includes('Dependencia pendiente')) {
            continue
          }
          await markOutboxFailed(item.id, msg)
          failed++
        }
      }

      if (progressThisPass === 0) break
      pass++
    }
  } finally {
    syncing = false
    if (synced > 0 || failed > 0) {
      emitOfflineSyncDone({ synced, failed })
    }
  }

  return { synced, failed }
}
