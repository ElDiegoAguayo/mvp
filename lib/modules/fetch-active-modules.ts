import type { SupabaseClient } from '@supabase/supabase-js'
import {
  compareModulesByAreaThenName,
  hydrateModuleArea,
  MODULE_AREA_SELECT,
  MODULE_WITH_AREA_SELECT,
  type ModuleArea,
  type ModuleWithArea,
} from '@/lib/modules/areas'

export type ActiveModuleRow = ModuleWithArea & {
  slug: string
  name: string
  icon: string
  description: string | null
  is_active: boolean
  is_core?: boolean
  embed_url?: string | null
  color?: string | null
  text_color?: string | null
  icon_shape?: string | null
  icon_size?: string | null
  icon_style?: string | null
  menu_badge?: string | null
}

async function loadModuleAreasMap(
  supabase: SupabaseClient,
): Promise<Map<string, ModuleArea>> {
  const { data } = await supabase
    .from('module_areas')
    .select(MODULE_AREA_SELECT)
    .order('display_order')

  return new Map((data ?? []).map((area) => [area.id, area as ModuleArea]))
}

/**
 * Carga módulos activos con área resuelta (join o lookup por area_id).
 * Usar en gestión de usuarios y cualquier vista que agrupe por área.
 */
export async function fetchActiveModules(
  supabase: SupabaseClient,
): Promise<ActiveModuleRow[]> {
  const areasById = await loadModuleAreasMap(supabase)

  const resWithArea = await supabase
    .from('modules')
    .select(MODULE_WITH_AREA_SELECT)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  let rows: ActiveModuleRow[] = []

  if (!resWithArea.error && resWithArea.data) {
    rows = resWithArea.data as ActiveModuleRow[]
  } else {
    const resFallback = await supabase
      .from('modules')
      .select(
        'id, slug, name, icon, color, text_color, icon_shape, icon_size, icon_style, menu_badge, description, is_active, is_core, embed_url, area_id',
      )
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (!resFallback.error && resFallback.data) {
      rows = resFallback.data as ActiveModuleRow[]
    } else {
      const resMinimal = await supabase
        .from('modules')
        .select('id, slug, name, icon, color, text_color, icon_shape, description, is_active, is_core, embed_url, area_id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (!resMinimal.error && resMinimal.data) {
        rows = resMinimal.data as ActiveModuleRow[]
      }
    }
  }

  return rows
    .filter((m) => m.slug !== 'inicio')
    .map((m) => hydrateModuleArea(m, areasById))
    .sort((a, b) => compareModulesByAreaThenName(a, b))
}
