import type { SupabaseClient } from '@supabase/supabase-js'
import { isInspectorAllowedModule } from '@/lib/admin/inspector-module-access'

/** Whether a user may open a module by slug (inspectors: allowed slugs; others: user_module_access). */
export async function userCanAccessModuleBySlug(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, parent_user_id, is_tech_inspector')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role === 'admin') return true

  if (profile?.is_tech_inspector && isInspectorAllowedModule({ slug })) {
    return true
  }

  const { data: mod } = await supabase
    .from('modules')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!mod) return false

  return userCanAccessModule(supabase, userId, mod.id)
}

/** Whether a user may open a module (own access + parent access for subusers). Admins always may. */
export async function userCanAccessModule(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, parent_user_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role === 'admin') return true

  const { data: ownAccess } = await supabase
    .from('user_module_access')
    .select('enabled')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .eq('enabled', true)
    .maybeSingle()

  if (!ownAccess) return false

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
