import type { SupabaseClient } from '@supabase/supabase-js'
import { TECH_ASSISTANCE_MODULE_SLUG } from '@/lib/admin/inspector-module-access'

export async function syncInspectorModulesOnly(
  adminClient: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: techModule } = await adminClient
    .from('modules')
    .select('id')
    .eq('slug', TECH_ASSISTANCE_MODULE_SLUG)
    .maybeSingle()

  await adminClient.from('user_module_access').delete().eq('user_id', userId)
  await adminClient.from('user_table_access').delete().eq('user_id', userId)
  await adminClient.from('user_chart_access').delete().eq('user_id', userId)

  if (!techModule?.id) return

  await adminClient.from('user_module_access').upsert(
    {
      user_id: userId,
      module_id: techModule.id,
      enabled: true,
      display_order: 0,
    },
    { onConflict: 'user_id,module_id' },
  )
}
