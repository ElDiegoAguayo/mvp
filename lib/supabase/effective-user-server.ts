import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getViewAsContext } from '@/lib/impersonation'
import {
  getEffectiveUserId as getEffectiveUserIdCore,
  type EffectiveUser,
} from '@/lib/supabase/effective-user'

/** Server-side effective user (reads view-as cookie when admin is in support mode). */
export async function getEffectiveUserId(
  supabase: SupabaseClient,
  viewAsUserId?: string | null,
): Promise<EffectiveUser> {
  let overrideId = viewAsUserId
  if (!overrideId) {
    const viewAs = await getViewAsContext()
    overrideId = viewAs.viewAsUserId
  }
  return getEffectiveUserIdCore(supabase, overrideId)
}

/** UUID used for cliente_id filters (respects modo soporte). */
export async function getDataOwnerId(supabase: SupabaseClient): Promise<string | null> {
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  return effectiveUserId
}
