import type { SupabaseClient } from '@supabase/supabase-js'
import { loadHarvestModuleData, loadPhenologyModuleData } from './agronomy-offline'
import { setCatalogCache } from './cache'

export interface FieldCacheStatus {
  preparedAt: number
  harvestOk: boolean
  phenologyOk: boolean
}

export async function prepareFieldCache(
  supabase: SupabaseClient,
  userId: string,
): Promise<FieldCacheStatus> {
  const [harvest, phenology] = await Promise.all([
    loadHarvestModuleData(supabase, userId),
    loadPhenologyModuleData(supabase, userId),
  ])

  const status: FieldCacheStatus = {
    preparedAt: Date.now(),
    harvestOk: !harvest.fromCache || harvest.estimates.length > 0 || harvest.blocks.length > 0,
    phenologyOk: !phenology.fromCache || phenology.observations.length > 0 || phenology.stages.length > 0,
  }

  await setCatalogCache(`field-ready:${userId}`, userId, 'harvest', status)
  return status
}

export async function getFieldCacheStatus(userId: string): Promise<FieldCacheStatus | null> {
  const { getCatalogCache } = await import('./cache')
  return getCatalogCache<FieldCacheStatus>(`field-ready:${userId}`)
}
