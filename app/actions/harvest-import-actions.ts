'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ParsedHarvestEstimate, ParsedHarvestImport } from '@/lib/agronomy/parse-harvest-xlsx'
import { assertHarvestWriteAccess, assertAdminHarvestImportAccess } from '@/lib/agronomy/harvest-owner-context'
import { aggregateCountByBlockVariety } from '@/lib/agronomy/aggregate-count-rows'
import { enrichAggregatedEstimateForEstimation } from '@/lib/agronomy/build-estimation-from-count'

function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function resolveOwnerId(
  service: NonNullable<ReturnType<typeof getServiceClient>>,
  clientUserId?: string | null,
) {
  const resolved = await assertHarvestWriteAccess(service, clientUserId ?? null)
  if (!resolved.ok) throw new Error(resolved.error)
  return resolved.ownerId
}

async function resolveAdminImportOwnerId(clientUserId: string) {
  const resolved = await assertAdminHarvestImportAccess(clientUserId)
  if (!resolved.ok) throw new Error(resolved.error)
  return resolved.ownerId
}

export type HarvestImportResult =
  | { ok: true; fields: number; blocks: number; estimates: number; season: string }
  | { ok: false; error: string }

type ImportMode = 'conteo' | 'estimacion'

async function syncCatalog(
  service: NonNullable<ReturnType<typeof getServiceClient>>,
  ownerId: string,
  data: ParsedHarvestImport,
) {
  if (data.fields.length > 0) {
    const { error } = await service.from('harvest_fields').upsert(
      data.fields.map((name) => ({ user_id: ownerId, name })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    )
    if (error) return error
  }

  if (data.blocks.length > 0) {
    const { error } = await service.from('harvest_blocks').upsert(
      data.blocks.map((b) => ({
        user_id: ownerId,
        field_name: b.field_name,
        block_name: b.block_name,
        crop: b.crop,
        variety: b.variety,
        hectares: b.hectares,
        plants_per_ha: b.plants_per_ha,
      })),
      { onConflict: 'user_id,field_name,block_name' },
    )
    if (error) return error
  }

  return null
}

async function findExistingCountSample(
  service: NonNullable<ReturnType<typeof getServiceClient>>,
  ownerId: string,
  e: ParsedHarvestEstimate,
) {
  const countState = e.count_state ?? 'Pre-poda'
  let query = service
    .from('harvest_estimates')
    .select('*')
    .eq('user_id', ownerId)
    .eq('field_name', e.field_name)
    .eq('block_name', e.block_name)
    .eq('season_label', e.season_label)
    .eq('count_state', countState)
    .eq('is_count_summary', false)

  if (e.hilera != null && e.arbol != null) {
    query = query.eq('hilera', e.hilera).eq('arbol', e.arbol)
  } else {
    query = query.is('hilera', null).is('arbol', null)
  }

  return query.maybeSingle()
}

async function findExistingCountSummary(
  service: NonNullable<ReturnType<typeof getServiceClient>>,
  ownerId: string,
  e: ParsedHarvestEstimate,
) {
  const countState = e.count_state ?? 'Pre-poda'
  return service
    .from('harvest_estimates')
    .select('*')
    .eq('user_id', ownerId)
    .eq('field_name', e.field_name)
    .eq('block_name', e.block_name)
    .eq('variety', e.variety || null)
    .eq('season_label', e.season_label)
    .eq('count_state', countState)
    .eq('is_count_summary', true)
    .maybeSingle()
}

/** @deprecated Usar findExistingCountSample o findExistingCountSummary */
async function findExistingEstimate(
  service: NonNullable<ReturnType<typeof getServiceClient>>,
  ownerId: string,
  e: ParsedHarvestEstimate,
) {
  if (e.is_count_summary) return findExistingCountSummary(service, ownerId, e)
  return findExistingCountSample(service, ownerId, e)
}

function buildCountSampleRow(
  ownerId: string,
  e: ParsedHarvestEstimate,
  date: string,
  existing: Record<string, unknown> | null,
) {
  return {
    user_id: ownerId,
    field_name: e.field_name,
    block_name: e.block_name,
    crop: e.crop.trim(),
    variety: e.variety || null,
    season_label: e.season_label,
    record_date: date,
    hectares: e.hectares > 0 ? e.hectares : null,
    plants_per_ha: e.plants_per_ha,
    hilera: e.hilera,
    arbol: e.arbol,
    is_count_summary: false,
    dardos_per_plant: e.dardos_per_plant,
    dardos_per_branch: e.dardos_per_branch,
    dardo_coral: e.dardo_coral,
    count_sample_count: null,
    primordia_per_dardo: e.primordia_per_dardo,
    primordia_per_branch: e.primordia_per_branch,
    fruit_set_pct: e.fruit_set_pct,
    fruits_set: e.fruits_set,
    fruit_weight_kg: e.fruit_weight_kg,
    kg_per_plant: null,
    kg_per_ha: null,
    estimated_kg: 0,
    harvested_kg: existing ? Number(existing.harvested_kg ?? 0) : 0,
    count_state: e.count_state ?? 'Pre-poda',
    status: existing ? String(existing.status ?? 'planificado') : 'planificado',
  }
}

function buildCountSummaryRow(
  ownerId: string,
  e: ParsedHarvestEstimate,
  date: string,
  existing: Record<string, unknown> | null,
  block?: { hectares: number | null; plants_per_ha: number | null; crop?: string } | null,
) {
  const enriched = enrichAggregatedEstimateForEstimation(e, block ? {
    field_name: e.field_name,
    block_name: e.block_name,
    crop: block.crop ?? e.crop,
    variety: e.variety || null,
    hectares: block.hectares,
    plants_per_ha: block.plants_per_ha,
  } : null)

  return {
    user_id: ownerId,
    field_name: enriched.field_name,
    block_name: enriched.block_name,
    crop: enriched.crop.trim(),
    variety: enriched.variety || null,
    season_label: enriched.season_label,
    record_date: date,
    hectares: enriched.hectares > 0 ? enriched.hectares : null,
    plants_per_ha: enriched.plants_per_ha,
    hilera: null,
    arbol: null,
    is_count_summary: true,
    dardos_per_plant: enriched.dardos_per_plant,
    dardos_per_branch: enriched.dardos_per_branch,
    dardo_coral: enriched.dardo_coral,
    count_sample_count: enriched.count_sample_count ?? null,
    primordia_per_dardo: enriched.primordia_per_dardo,
    primordia_per_branch: enriched.primordia_per_branch,
    fruit_set_pct: enriched.fruit_set_pct,
    fruits_set: enriched.fruits_set,
    fruit_weight_kg: enriched.fruit_weight_kg,
    kg_per_plant: enriched.kg_per_plant,
    kg_per_ha: enriched.kg_per_ha,
    estimated_kg: enriched.estimated_kg,
    harvested_kg: existing ? Number(existing.harvested_kg ?? 0) : 0,
    count_state: enriched.count_state ?? 'Pre-poda',
    status: existing ? String(existing.status ?? 'planificado') : 'planificado',
  }
}

function buildCountRow(
  ownerId: string,
  e: ParsedHarvestEstimate,
  date: string,
  existing: Record<string, unknown> | null,
) {
  if (e.is_count_summary) return buildCountSummaryRow(ownerId, e, date, existing)
  return buildCountSampleRow(ownerId, e, date, existing)
}

function buildEstimationRow(
  ownerId: string,
  e: ParsedHarvestEstimate,
  date: string,
  existing: Record<string, unknown> | null,
) {
  return {
    user_id: ownerId,
    field_name: e.field_name,
    block_name: e.block_name,
    crop: e.crop.trim() || (existing ? String(existing.crop) : 'Cerezo'),
    variety: e.variety || (existing ? (existing.variety as string | null) : null),
    season_label: e.season_label,
    record_date: date,
    hectares: e.hectares,
    plants_per_ha: existing?.plants_per_ha ?? e.plants_per_ha,
    dardos_per_plant: existing?.dardos_per_plant ?? e.dardos_per_plant,
    dardos_per_branch: existing?.dardos_per_branch ?? e.dardos_per_branch,
    primordia_per_dardo: existing?.primordia_per_dardo ?? e.primordia_per_dardo,
    primordia_per_branch: existing?.primordia_per_branch ?? e.primordia_per_branch,
    fruit_set_pct: existing?.fruit_set_pct ?? e.fruit_set_pct,
    fruits_set: e.fruits_set ?? existing?.fruits_set ?? null,
    fruit_weight_kg: existing?.fruit_weight_kg ?? e.fruit_weight_kg,
    kg_per_plant: e.kg_per_plant ?? existing?.kg_per_plant ?? null,
    kg_per_ha: e.kg_per_ha ?? existing?.kg_per_ha ?? null,
    estimated_kg: e.estimated_kg,
    harvested_kg: e.harvested_kg ?? (existing ? Number(existing.harvested_kg ?? 0) : 0),
    count_state: e.count_state ?? existing?.count_state ?? 'Pre-poda',
    status: existing ? String(existing.status ?? 'planificado') : 'planificado',
  }
}

async function importHarvestData(
  data: ParsedHarvestImport,
  replaceExisting: boolean,
  mode: ImportMode,
  recordDate?: string,
  clientUserId?: string | null,
): Promise<HarvestImportResult> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const service = getServiceClient()
  if (!service) return { ok: false, error: 'Servicio no configurado' }

  if (!clientUserId) return { ok: false, error: 'Cliente no especificado.' }

  let ownerId: string
  try {
    ownerId = await resolveAdminImportOwnerId(clientUserId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No autorizado' }
  }
  const date = recordDate || new Date().toISOString().slice(0, 10)

  if (replaceExisting) {
    for (const table of ['harvest_estimates', 'harvest_blocks', 'harvest_fields'] as const) {
      const { error } = await service.from(table).delete().eq('user_id', ownerId)
      if (error) return { ok: false, error: error.message }
    }
  }

  const catalogError = await syncCatalog(service, ownerId, data)
  if (catalogError) return { ok: false, error: catalogError.message }

  for (const e of data.estimates) {
    const { data: existingRow } = await findExistingCountSample(service, ownerId, e)
    const existing = existingRow as Record<string, unknown> | null
    const payload = mode === 'conteo'
      ? buildCountSampleRow(ownerId, e, date, existing)
      : buildEstimationRow(ownerId, e, date, existing)

    if (existing?.id) {
      const { error } = await service
        .from('harvest_estimates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', String(existing.id))
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await service.from('harvest_estimates').insert(payload)
      if (error) return { ok: false, error: error.message }
    }
  }

  if (mode === 'conteo') {
    const summaries = aggregateCountByBlockVariety(data.estimates)
    for (const summary of summaries) {
      const block = data.blocks.find(
        (b) => b.field_name === summary.field_name && b.block_name === summary.block_name,
      )
      const { data: existingRow } = await findExistingCountSummary(service, ownerId, summary)
      const existing = existingRow as Record<string, unknown> | null
      const payload = buildCountSummaryRow(ownerId, summary, date, existing, block)

      if (existing?.id) {
        const { error } = await service
          .from('harvest_estimates')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', String(existing.id))
        if (error) return { ok: false, error: error.message }
      } else {
        const { error } = await service.from('harvest_estimates').insert(payload)
        if (error) return { ok: false, error: error.message }
      }
    }
  }

  revalidatePath('/dashboard/estimacion-cosecha')
  revalidatePath('/admin')

  return {
    ok: true,
    fields: data.fields.length,
    blocks: data.blocks.length,
    estimates: data.estimates.length,
    season: data.season_label,
  }
}

export async function syncEstimationsFromCountAction(
  seasonLabel?: string,
  clientUserId?: string | null,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const service = getServiceClient()
  if (!service) return { ok: false, error: 'Servicio no configurado' }

  let ownerId: string
  try {
    ownerId = await resolveOwnerId(service, clientUserId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No autorizado' }
  }
  const date = new Date().toISOString().slice(0, 10)

  const { data: samples, error: sampleError } = await service
    .from('harvest_estimates')
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_count_summary', false)

  if (sampleError) return { ok: false, error: sampleError.message }

  const { data: blocks, error: blockError } = await service
    .from('harvest_blocks')
    .select('*')
    .eq('user_id', ownerId)

  if (blockError) return { ok: false, error: blockError.message }

  const sampleRows = (samples ?? []).filter(
    (s) => s.hilera != null || s.arbol != null,
  ) as ParsedHarvestEstimate[]
  if (sampleRows.length === 0) {
    return { ok: false, error: 'No hay muestras de conteo para calcular estimaciones' }
  }

  const summaries = aggregateCountByBlockVariety(sampleRows)
  let updated = 0

  for (const summary of summaries) {
    const season = seasonLabel || summary.season_label
    const block = (blocks ?? []).find(
      (b) => b.field_name === summary.field_name && b.block_name === summary.block_name,
    )
    const withSeason = { ...summary, season_label: season }
    const { data: existingRow } = await findExistingCountSummary(service, ownerId, withSeason)
    const existing = existingRow as Record<string, unknown> | null
    const payload = buildCountSummaryRow(ownerId, withSeason, date, existing, block)

    if (existing?.id) {
      const { error } = await service
        .from('harvest_estimates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', String(existing.id))
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await service.from('harvest_estimates').insert(payload)
      if (error) return { ok: false, error: error.message }
    }
    updated++
  }

  revalidatePath('/dashboard/estimacion-cosecha')
  return { ok: true, updated }
}

export async function importCountFromExcelAction(
  data: ParsedHarvestImport,
  replaceExisting: boolean,
  recordDate?: string,
  clientUserId?: string | null,
): Promise<HarvestImportResult> {
  return importHarvestData(data, replaceExisting, 'conteo', recordDate, clientUserId)
}

export async function importEstimationFromExcelAction(
  data: ParsedHarvestImport,
  replaceExisting: boolean,
  recordDate?: string,
  clientUserId?: string | null,
): Promise<HarvestImportResult> {
  return importHarvestData(data, replaceExisting, 'estimacion', recordDate, clientUserId)
}

/** @deprecated Usar importEstimationFromExcelAction o importCountFromExcelAction */
export async function importHarvestFromExcelAction(
  data: ParsedHarvestImport,
  replaceExisting: boolean,
  recordDate?: string,
): Promise<HarvestImportResult> {
  return importEstimationFromExcelAction(data, replaceExisting, recordDate)
}

export async function clearAllHarvestDataAction(
  clientUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const service = getServiceClient()
  if (!service) return { ok: false, error: 'Servicio no configurado' }

  let ownerId: string
  try {
    ownerId = await resolveOwnerId(service, clientUserId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No autorizado' }
  }

  for (const table of ['harvest_estimates', 'harvest_blocks', 'harvest_fields'] as const) {
    const { error } = await service.from(table).delete().eq('user_id', ownerId)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/estimacion-cosecha')
  return { ok: true }
}

export async function deleteAllHarvestFieldsAction(
  clientUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const service = getServiceClient()
  if (!service) return { ok: false, error: 'Servicio no configurado' }

  let ownerId: string
  try {
    ownerId = await resolveOwnerId(service, clientUserId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No autorizado' }
  }

  const { error } = await service.from('harvest_fields').delete().eq('user_id', ownerId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/estimacion-cosecha')
  return { ok: true }
}

export async function deleteAllHarvestBlocksAction(
  clientUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const service = getServiceClient()
  if (!service) return { ok: false, error: 'Servicio no configurado' }

  let ownerId: string
  try {
    ownerId = await resolveOwnerId(service, clientUserId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No autorizado' }
  }

  const { error } = await service.from('harvest_blocks').delete().eq('user_id', ownerId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/estimacion-cosecha')
  return { ok: true }
}
