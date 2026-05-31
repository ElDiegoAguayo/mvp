import type { SupabaseClient } from '@supabase/supabase-js'
import { TECH_ASSISTANCE_MODULE_SLUG } from '@/lib/admin/inspector-module-access'
import { applyPrincipalClientFilters } from '@/lib/profiles/principal-clients'

export type InspectorClientOption = {
  id: string
  label: string
}

/** Clientes que un inspector puede elegir al marcar asistencia. */
export async function fetchInspectorClientOptions(
  supabase: SupabaseClient,
  inspectorId: string,
): Promise<InspectorClientOption[]> {
  const { data: assignments } = await supabase
    .from('tech_assistance_inspector_clients')
    .select('client_user_id')
    .eq('inspector_id', inspectorId)

  const assignedIds = (assignments ?? []).map(r => r.client_user_id as string)

  let clientIds = assignedIds

  if (clientIds.length === 0) {
    const { data: mod } = await supabase
      .from('modules')
      .select('id')
      .eq('slug', TECH_ASSISTANCE_MODULE_SLUG)
      .maybeSingle()

    if (!mod?.id) return []

    const { data: accessRows } = await supabase
      .from('user_module_access')
      .select('user_id')
      .eq('module_id', mod.id)
      .eq('enabled', true)

    clientIds = [...new Set((accessRows ?? []).map(r => r.user_id as string))]
  }

  if (!clientIds.length) return []

  const { data: profiles } = await applyPrincipalClientFilters(
    supabase.from('profiles').select('id, full_name, email').in('id', clientIds),
  ).order('full_name')

  return (profiles ?? []).map(p => ({
    id: p.id as string,
    label: (p.full_name as string)?.trim() || (p.email as string) || (p.id as string),
  }))
}

export async function inspectorCanAccessClient(
  supabase: SupabaseClient,
  inspectorId: string,
  clientUserId: string,
): Promise<boolean> {
  const clients = await fetchInspectorClientOptions(supabase, inspectorId)
  return clients.some(c => c.id === clientUserId)
}
