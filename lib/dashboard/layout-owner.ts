import type { SupabaseClient } from '@supabase/supabase-js'

export type LayoutProfileRef = {
  id: string
  parent_user_id?: string | null
  full_name?: string | null
  email?: string | null
}

/** User id whose row in dashboard_layouts applies (principal for subusers). */
export function resolveDashboardLayoutOwnerId(
  userId: string,
  parentUserId?: string | null,
): string {
  return parentUserId ?? userId
}

export async function fetchDashboardLayoutOwnerId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('parent_user_id')
    .eq('id', userId)
    .maybeSingle()

  return resolveDashboardLayoutOwnerId(userId, data?.parent_user_id)
}

export async function fetchLayoutProfileRef(
  supabase: SupabaseClient,
  userId: string,
): Promise<LayoutProfileRef | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, parent_user_id, full_name, email')
    .eq('id', userId)
    .maybeSingle()

  return data as LayoutProfileRef | null
}

export function formatLayoutUserLabel(profile: LayoutProfileRef | null, fallbackId?: string): string {
  if (!profile) return fallbackId ?? 'Usuario'
  return profile.full_name?.trim() || profile.email?.trim() || profile.id
}
