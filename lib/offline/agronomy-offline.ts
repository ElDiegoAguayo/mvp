import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCatalogCache,
  setCatalogCache,
  harvestCacheKey,
  phenologyCacheKey,
} from './cache'
import { isBrowserOnline, isNetworkError } from './network'
import {
  queueOutboxItem,
  addPendingFiles,
  getPendingOutboxItems,
} from './outbox'
import { syncOfflineQueue } from './sync-engine'
import type { OfflineTable, OfflineWriteResult, OutboxOperation } from './types'
import { generateLocalId, isLocalRecordId } from './types'

// ─── Generic write ───────────────────────────────────────────────────────────

interface WriteOptions {
  userId: string
  table: OfflineTable
  operation: OutboxOperation
  payload: Record<string, unknown>
  match?: Record<string, unknown>
  localRecordId?: string
  onConflict?: string
  /** Apply optimistic patch to harvest/phenology cache */
  cacheModule?: 'harvest' | 'phenology'
  cacheListKey?: string
  optimisticRecord?: Record<string, unknown>
}

async function applyOptimisticCache(
  userId: string,
  module: 'harvest' | 'phenology',
  listKey: string,
  operation: OutboxOperation,
  record: Record<string, unknown>,
  match?: Record<string, unknown>,
): Promise<void> {
  const cacheKey = module === 'harvest' ? harvestCacheKey(userId) : phenologyCacheKey(userId)
  const cached = (await getCatalogCache<Record<string, unknown[]>>(cacheKey)) ?? {}
  const list = [...(cached[listKey] ?? [])] as Record<string, unknown>[]

  if (operation === 'delete' && match?.id) {
    cached[listKey] = list.filter((r) => r.id !== match.id)
  } else if (operation === 'insert' || operation === 'upsert') {
    const id = String(record.id ?? '')
    const idx = list.findIndex((r) => r.id === id)
    if (idx >= 0) list[idx] = { ...list[idx], ...record, _offlinePending: true }
    else list.unshift({ ...record, _offlinePending: true })
    cached[listKey] = list
  } else if (operation === 'update' && match?.id) {
    cached[listKey] = list.map((r) =>
      r.id === match.id ? { ...r, ...record, _offlinePending: true } : r,
    )
  }

  await setCatalogCache(cacheKey, userId, module, cached)
}

export async function offlineWrite(
  supabase: SupabaseClient,
  options: WriteOptions,
): Promise<OfflineWriteResult> {
  const localId = options.localRecordId ?? (options.operation === 'insert' ? generateLocalId() : undefined)

  if (isBrowserOnline()) {
    try {
      switch (options.operation) {
        case 'insert': {
          const { data, error } = await supabase
            .from(options.table)
            .insert(options.payload)
            .select('*')
            .single()
          if (error) throw error
          return { ok: true, localRecordId: data?.id ? String(data.id) : localId }
        }
        case 'update': {
          let query = supabase.from(options.table).update(options.payload)
          if (options.match) {
            for (const [k, v] of Object.entries(options.match)) {
              query = query.eq(k, v as string)
            }
          }
          const { error } = await query
          if (error) throw error
          return { ok: true }
        }
        case 'upsert': {
          const { error } = await supabase
            .from(options.table)
            .upsert(options.payload, options.onConflict ? { onConflict: options.onConflict } : undefined)
          if (error) throw error
          return { ok: true, localRecordId: localId }
        }
        case 'delete': {
          let query = supabase.from(options.table).delete()
          if (options.match) {
            for (const [k, v] of Object.entries(options.match)) {
              query = query.eq(k, v as string)
            }
          }
          const { error } = await query
          if (error) throw error
          return { ok: true }
        }
      }
    } catch (err) {
      if (!isNetworkError(err)) {
        const msg = err instanceof Error ? err.message : 'Error al guardar'
        return { ok: false, error: msg }
      }
      // fall through to offline queue
    }
  }

  const optimistic = options.optimisticRecord ?? {
    ...options.payload,
    id: localId ?? options.match?.id,
    updated_at: new Date().toISOString(),
  }

  if (options.cacheModule && options.cacheListKey) {
    await applyOptimisticCache(
      options.userId,
      options.cacheModule,
      options.cacheListKey,
      options.operation,
      optimistic,
      options.match ?? (localId ? { id: localId } : undefined),
    )
  }

  await queueOutboxItem({
    userId: options.userId,
    table: options.table,
    operation: options.operation,
    payload: options.payload,
    match: options.match,
    localRecordId: localId,
    onConflict: options.onConflict,
  })

  return { ok: true, offline: true, localRecordId: localId }
}

function mergePendingIntoList<T extends { id: string }>(
  serverRows: T[],
  pendingItems: Awaited<ReturnType<typeof getPendingOutboxItems>>,
  table: OfflineTable,
  listKey: keyof T extends never ? string : string,
): T[] {
  const map = new Map(serverRows.map((r) => [r.id, { ...r }]))
  const tableItems = pendingItems.filter((i) => i.table === table)

  for (const item of tableItems) {
    const id = item.localRecordId ?? String(item.match?.id ?? '')
    if (item.operation === 'delete' && item.match?.id) {
      map.delete(String(item.match.id))
      continue
    }
    const record = {
      ...(item.payload as T),
      id: id || String((item.payload as { id?: string }).id ?? generateLocalId()),
      _offlinePending: true,
    } as T
    if (item.operation === 'update' && item.match?.id) {
      const existing = map.get(String(item.match.id))
      map.set(String(item.match.id), { ...existing, ...record } as T)
    } else {
      map.set(record.id, record)
    }
  }

  return [...map.values()]
}

// ─── Harvest load ────────────────────────────────────────────────────────────

export interface HarvestModuleData {
  estimates: Record<string, unknown>[]
  blocks: Record<string, unknown>[]
  fields: Record<string, unknown>[]
  fromCache: boolean
}

export async function loadHarvestModuleData(
  supabase: SupabaseClient,
  userId: string,
): Promise<HarvestModuleData> {
  const cacheKey = harvestCacheKey(userId)
  const pending = await getPendingOutboxItems(userId)

  if (isBrowserOnline()) {
    try {
      const [estRes, blockRes, fieldRes] = await Promise.all([
        supabase.from('harvest_estimates').select('*').eq('user_id', userId).order('record_date', { ascending: false }),
        supabase.from('harvest_blocks').select('*').eq('user_id', userId).order('field_name').order('block_name'),
        supabase.from('harvest_fields').select('id, name').eq('user_id', userId).order('name'),
      ])

      if (estRes.error) throw estRes.error

      const data: HarvestModuleData = {
        estimates: mergePendingIntoList(
          (estRes.data ?? []) as { id: string }[],
          pending,
          'harvest_estimates',
          'estimates',
        ) as Record<string, unknown>[],
        blocks: mergePendingIntoList(
          (blockRes.error ? [] : blockRes.data ?? []) as { id: string }[],
          pending,
          'harvest_blocks',
          'blocks',
        ) as Record<string, unknown>[],
        fields: mergePendingIntoList(
          (fieldRes.error ? [] : fieldRes.data ?? []) as { id: string }[],
          pending,
          'harvest_fields',
          'fields',
        ) as Record<string, unknown>[],
        fromCache: false,
      }

      await setCatalogCache(cacheKey, userId, 'harvest', {
        estimates: data.estimates,
        blocks: data.blocks,
        fields: data.fields,
      })

      return data
    } catch (err) {
      if (!isNetworkError(err)) throw err
    }
  }

  const cached = await getCatalogCache<{
    estimates: Record<string, unknown>[]
    blocks: Record<string, unknown>[]
    fields: Record<string, unknown>[]
  }>(cacheKey)

  if (!cached) {
    return { estimates: [], blocks: [], fields: [], fromCache: true }
  }

  return {
    estimates: mergePendingIntoList(
      (cached.estimates ?? []) as { id: string }[],
      pending,
      'harvest_estimates',
      'estimates',
    ) as Record<string, unknown>[],
    blocks: mergePendingIntoList(
      (cached.blocks ?? []) as { id: string }[],
      pending,
      'harvest_blocks',
      'blocks',
    ) as Record<string, unknown>[],
    fields: mergePendingIntoList(
      (cached.fields ?? []) as { id: string }[],
      pending,
      'harvest_fields',
      'fields',
    ) as Record<string, unknown>[],
    fromCache: true,
  }
}

// ─── Phenology load ──────────────────────────────────────────────────────────

export interface PhenologyModuleData {
  stages: Record<string, unknown>[]
  observations: Record<string, unknown>[]
  images: Record<string, unknown>[]
  blocks: Record<string, unknown>[]
  fromCache: boolean
}

export async function loadPhenologyModuleData(
  supabase: SupabaseClient,
  userId: string,
): Promise<PhenologyModuleData> {
  const cacheKey = phenologyCacheKey(userId)
  const pending = await getPendingOutboxItems(userId)

  if (isBrowserOnline()) {
    try {
      const [stRes, obRes, imgRes, blockRes] = await Promise.all([
        supabase.from('phenology_stages').select('*').eq('user_id', userId).order('crop').order('sort_order'),
        supabase.from('phenology_observations').select('*').eq('user_id', userId).order('observed_at', { ascending: true }),
        supabase.from('phenology_observation_images').select('id, observation_id, storage_path, file_name, mime_type, sort_order').eq('user_id', userId).order('sort_order'),
        supabase.from('harvest_blocks').select('id, field_name, block_name, crop, variety').eq('user_id', userId).order('field_name').order('block_name'),
      ])

      if (stRes.error) throw stRes.error
      if (obRes.error) throw obRes.error

      const data: PhenologyModuleData = {
        stages: mergePendingIntoList(
          (stRes.data ?? []) as { id: string }[],
          pending,
          'phenology_stages',
          'stages',
        ) as Record<string, unknown>[],
        observations: mergePendingIntoList(
          (obRes.data ?? []) as { id: string }[],
          pending,
          'phenology_observations',
          'observations',
        ) as Record<string, unknown>[],
        images: (imgRes.error ? [] : imgRes.data ?? []) as Record<string, unknown>[],
        blocks: (blockRes.error ? [] : blockRes.data ?? []) as Record<string, unknown>[],
        fromCache: false,
      }

      await setCatalogCache(cacheKey, userId, 'phenology', {
        stages: data.stages,
        observations: data.observations,
        images: data.images,
        blocks: data.blocks,
      })

      return data
    } catch (err) {
      if (!isNetworkError(err)) throw err
    }
  }

  const cached = await getCatalogCache<{
    stages: Record<string, unknown>[]
    observations: Record<string, unknown>[]
    images: Record<string, unknown>[]
    blocks: Record<string, unknown>[]
  }>(cacheKey)

  if (!cached) {
    return { stages: [], observations: [], images: [], blocks: [], fromCache: true }
  }

  return {
    stages: mergePendingIntoList(
      (cached.stages ?? []) as { id: string }[],
      pending,
      'phenology_stages',
      'stages',
    ) as Record<string, unknown>[],
    observations: mergePendingIntoList(
      (cached.observations ?? []) as { id: string }[],
      pending,
      'phenology_observations',
      'observations',
    ) as Record<string, unknown>[],
    images: cached.images ?? [],
    blocks: cached.blocks ?? [],
    fromCache: true,
  }
}

// ─── Phenology observation with photos ───────────────────────────────────────

export async function savePhenologyObservationOffline(
  supabase: SupabaseClient,
  options: {
    userId: string
    payload: Record<string, unknown>
    editingId?: string | null
    pendingImages?: File[]
    startImageOrder?: number
  },
): Promise<OfflineWriteResult & { observationId?: string }> {
  const editingId = options.editingId ?? null
  const isLocalEdit = isLocalRecordId(editingId)
  const isServerEdit = !!editingId && !isLocalEdit
  const isNew = !editingId

  if (isBrowserOnline() && isServerEdit) {
    try {
      const { error } = await supabase
        .from('phenology_observations')
        .update(options.payload)
        .eq('id', editingId!)
      if (error) throw error

      if (options.pendingImages?.length) {
        for (let i = 0; i < options.pendingImages.length; i++) {
          const file = options.pendingImages[i]
          const safeName = file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
          const storagePath = `${options.userId}/phenology/${editingId}/${Date.now()}-${i}-${safeName}`
          const { error: upErr } = await supabase.storage
            .from('fenologia')
            .upload(storagePath, file, { contentType: file.type, upsert: false })
          if (upErr) throw upErr
          const { error: dbErr } = await supabase.from('phenology_observation_images').insert({
            observation_id: editingId,
            user_id: options.userId,
            storage_path: storagePath,
            file_name: safeName,
            mime_type: file.type,
            file_size: file.size,
            sort_order: (options.startImageOrder ?? 0) + i,
          })
          if (dbErr) throw dbErr
        }
      }
      return { ok: true, observationId: editingId! }
    } catch (err) {
      if (!isNetworkError(err)) {
        return { ok: false, error: err instanceof Error ? err.message : 'Error al guardar' }
      }
    }
  }

  if (isBrowserOnline() && isNew) {
    try {
      const { data, error } = await supabase
        .from('phenology_observations')
        .insert(options.payload)
        .select('id')
        .single()
      if (error) throw error
      const observationId = String(data.id)

      if (options.pendingImages?.length) {
        for (let i = 0; i < options.pendingImages.length; i++) {
          const file = options.pendingImages[i]
          const safeName = file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
          const storagePath = `${options.userId}/phenology/${observationId}/${Date.now()}-${i}-${safeName}`
          const { error: upErr } = await supabase.storage
            .from('fenologia')
            .upload(storagePath, file, { contentType: file.type, upsert: false })
          if (upErr) throw upErr
          const { error: dbErr } = await supabase.from('phenology_observation_images').insert({
            observation_id: observationId,
            user_id: options.userId,
            storage_path: storagePath,
            file_name: safeName,
            mime_type: file.type,
            file_size: file.size,
            sort_order: (options.startImageOrder ?? 0) + i,
          })
          if (dbErr) throw dbErr
        }
      }
      return { ok: true, observationId }
    } catch (err) {
      if (!isNetworkError(err)) {
        return { ok: false, error: err instanceof Error ? err.message : 'Error al guardar' }
      }
    }
  }

  const localId = isLocalEdit ? editingId! : isNew ? generateLocalId() : editingId!
  const operation = isNew ? 'insert' : 'update'

  const result = await offlineWrite(supabase, {
    userId: options.userId,
    table: 'phenology_observations',
    operation,
    payload: options.payload,
    match: !isNew ? { id: localId } : undefined,
    localRecordId: isNew || isLocalEdit ? localId : undefined,
    cacheModule: 'phenology',
    cacheListKey: 'observations',
    optimisticRecord: {
      ...options.payload,
      id: localId,
      created_at: new Date().toISOString(),
    },
  })

  if (result.ok && options.pendingImages?.length) {
    const outboxItems = await getPendingOutboxItems(options.userId)
    const obsItem = outboxItems.find(
      (i) =>
        (i.localRecordId === localId || i.match?.id === localId) &&
        i.table === 'phenology_observations',
    )
    if (obsItem) {
      await addPendingFiles(
        options.pendingImages.map((file, i) => ({
          userId: options.userId,
          observationLocalId: localId,
          outboxId: obsItem.id,
          file,
          sortOrder: (options.startImageOrder ?? 0) + i,
        })),
      )
    }
  }

  return { ...result, observationId: localId }
}

export { syncOfflineQueue, isLocalRecordId }
