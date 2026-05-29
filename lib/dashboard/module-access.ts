import type { SupabaseClient } from '@supabase/supabase-js'

/** Whether a user may open a module (own access + parent access for subusers). */
export async function userCanAccessModule(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
): Promise<boolean> {
  const { data: ownAccess } = await supabase
    .from('user_module_access')
    .select('enabled')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .eq('enabled', true)
    .maybeSingle()

  if (!ownAccess) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('parent_user_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.parent_user_id) return true

  const { data: parentAccess } = await supabase
    .from('user_module_access')
    .select('enabled')
    .eq('user_id', profile.parent_user_id)
    .eq('module_id', moduleId)
    .eq('enabled', true)
    .maybeSingle()

  return !!parentAccess
}
