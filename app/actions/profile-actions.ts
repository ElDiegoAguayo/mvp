'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { getViewAsContext } from '@/lib/impersonation'
import { fetchClientStorageForUser } from '@/lib/client-storage-server'
import { fetchActiveModules } from '@/lib/modules/fetch-active-modules'
import {
  getStoragePlanById,
  resolveStoragePlanId,
  resolveStorageQuotaBytes,
  formatQuotaLimit,
} from '@/lib/vault-storage'
import type { ClientStorageModule } from '@/lib/client-storage'

import type { ServicePlanId } from '@/lib/subscription-plans'
import { isServicePlanId } from '@/lib/subscription-plans'
import type { TechLocationOption } from '@/app/actions/tech-assistance-location-actions'
import { isPrincipalClientProfile } from '@/lib/profiles/principal-clients'

export interface ProfilePageData {
  profile: {
    id: string
    full_name: string
    email: string | null
    role: string
    avatar_url: string | null
    created_at: string | null
    isSubuser: boolean
    parentName: string | null
    parentEmail: string | null
  }
  linkedSubusersCount: number | null
  servicePlanId: ServicePlanId | null
  storagePlan: {
    planId: string
    planLabel: string
    usedBytes: number
    quotaBytes: number
    quotaLabel: string
    modules: ClientStorageModule[]
  } | null
  enabledModules: Array<{ id: string; slug: string; name: string; icon: string }>
  showClientLocations: boolean
  clientLocations: TechLocationOption[]
}

async function resolveActingUserId(sessionUserId: string): Promise<string> {
  const viewAs = await getViewAsContext()
  return viewAs.viewAsUserId ?? sessionUserId
}

async function resolveServicePlanId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  ownerId: string,
): Promise<ServicePlanId | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('service_plan_id')
    .eq('id', ownerId)
    .maybeSingle()

  if (error?.message?.includes('service_plan_id')) return null
  return isServicePlanId(data?.service_plan_id) ? data.service_plan_id : null
}

export async function getMyProfilePageDataAction(): Promise<ProfilePageData | null> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const actingUserId = await resolveActingUserId(user.id)

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_url, created_at, parent_user_id, storage_quota_gb, storage_quota_bytes, is_tech_inspector')
    .eq('id', actingUserId)
    .single()

  if (!profileRow) return null

  let parentName: string | null = null
  let parentEmail: string | null = null
  if (profileRow.parent_user_id) {
    const { data: parent } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', profileRow.parent_user_id)
      .maybeSingle()
    parentName = parent?.full_name?.trim() || null
    parentEmail = parent?.email ?? null
  }

  let linkedSubusersCount: number | null = null
  if (isPrincipalClientProfile(profileRow)) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_user_id', actingUserId)
    linkedSubusersCount = count ?? 0
  }

  const storageOwnerId = profileRow.parent_user_id ?? actingUserId
  const servicePlanId = await resolveServicePlanId(supabase, storageOwnerId)
  let storagePlan: ProfilePageData['storagePlan'] = null

  if (profileRow.role === 'user' || profileRow.parent_user_id) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('storage_quota_gb, storage_quota_bytes')
      .eq('id', storageOwnerId)
      .maybeSingle()

    const clientStorage = await fetchClientStorageForUser(actingUserId)
    const quotaBytes =
      clientStorage?.quotaBytes ??
      resolveStorageQuotaBytes({
        storage_quota_bytes: ownerProfile?.storage_quota_bytes,
        storage_quota_gb: ownerProfile?.storage_quota_gb,
      })
    const usedBytes = clientStorage?.usedBytes ?? 0
    const planId = resolveStoragePlanId({
      storage_quota_bytes: ownerProfile?.storage_quota_bytes,
      storage_quota_gb: ownerProfile?.storage_quota_gb,
    })
    const plan = getStoragePlanById(planId)

    storagePlan = {
      planId,
      planLabel: plan?.label ?? formatQuotaLimit(quotaBytes),
      usedBytes,
      quotaBytes,
      quotaLabel: formatQuotaLimit(quotaBytes),
      modules: clientStorage?.modules ?? [],
    }
  }

  const { data: accessRows } = await supabase
    .from('user_module_access')
    .select('module_id')
    .eq('user_id', actingUserId)
    .eq('enabled', true)

  const enabledIds = (accessRows ?? []).map(r => r.module_id)
  let enabledModules: ProfilePageData['enabledModules'] = []

  if (enabledIds.length > 0) {
    const allModules = await fetchActiveModules(supabase)
    const idSet = new Set(enabledIds)
    enabledModules = allModules
      .filter(m => idSet.has(m.id))
      .map(m => ({ id: m.id, slug: m.slug, name: m.name, icon: m.icon }))
  }

  const showClientLocations =
    profileRow.role === 'user' && profileRow.is_tech_inspector !== true
  let clientLocations: TechLocationOption[] = []

  if (showClientLocations) {
    const { data: locRows } = await supabase
      .from('tech_assistance_locations')
      .select('id, name, lat, lng, radius_meters, search_query')
      .eq('user_id', storageOwnerId)
      .eq('is_active', true)
      .order('name')
      .limit(1)
    clientLocations = (locRows ?? []) as TechLocationOption[]
  }

  return {
    profile: {
      id: profileRow.id,
      full_name:
        profileRow.full_name ||
        profileRow.email?.split('@')[0] ||
        'Usuario',
      email: profileRow.email,
      role: profileRow.role,
      avatar_url: profileRow.avatar_url,
      created_at: profileRow.created_at,
      isSubuser: !!profileRow.parent_user_id,
      parentName,
      parentEmail,
    },
    linkedSubusersCount,
    servicePlanId,
    storagePlan,
    enabledModules,
    showClientLocations,
    clientLocations,
  }
}
