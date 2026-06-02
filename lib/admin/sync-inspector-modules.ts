import type { SupabaseClient } from '@supabase/supabase-js'
import { INSPECTOR_ALLOWED_MODULE_SLUGS } from '@/lib/admin/inspector-module-access'

export async function syncInspectorModulesOnly(
  adminClient: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: allowedModules } = await adminClient
    .from('modules')
    .select('id, slug')
    .in('slug', [...INSPECTOR_ALLOWED_MODULE_SLUGS])

  await adminClient.from('user_module_access').delete().eq('user_id', userId)
  await adminClient.from('user_table_access').delete().eq('user_id', userId)
  await adminClient.from('user_chart_access').delete().eq('user_id', userId)

  if (!allowedModules?.length) return

  const displayOrder: Record<string, number> = {
    'asistencia-tecnica': 0,
    'estados-fenologicos': 1,
    'estimacion-cosecha': 2,
  }

  const rows = allowedModules.map((mod, idx) => ({
    user_id: userId,
    module_id: mod.id,
    enabled: true,
    display_order: displayOrder[mod.slug] ?? idx,
  }))

  const { error: upsertError } = await adminClient
    .from('user_module_access')
    .upsert(rows, { onConflict: 'user_id,module_id' })

  if (upsertError) {
    throw new Error(upsertError.message)
  }
}
