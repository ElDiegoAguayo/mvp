import type { SupabaseClient } from '@supabase/supabase-js'

export type EffectiveUser = {
  userId: string | null
  effectiveUserId: string | null
}

/** Client override set by ViewAsProvider when admin impersonates a user. */
let clientViewAsUserId: string | null = null

export function setClientViewAsUserId(userId: string | null) {
  clientViewAsUserId = userId
}

export async function getEffectiveUserId(
  supabase: SupabaseClient,
  viewAsUserId?: string | null,
): Promise<EffectiveUser> {
  const overrideId = viewAsUserId ?? clientViewAsUserId

  if (overrideId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('parent_user_id')
      .eq('id', overrideId)
      .single()

    return {
      userId: overrideId,
      effectiveUserId: profile?.parent_user_id ?? overrideId,
    }
  }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { userId: null, effectiveUserId: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('parent_user_id')
    .eq('id', user.id)
    .single()

  return {
    userId: user.id,
    effectiveUserId: profile?.parent_user_id ?? user.id,
  }
}
