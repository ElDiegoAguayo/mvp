/**
 * Server-side dashboard layout loader
 * Used in Server Components to fetch layout and permissions
 */

import { WidgetConfig } from '@/lib/dashboard/widget-config'
import {
  createPermissions,
  UserPermissions,
  filterWidgetsByPermissions,
} from '@/lib/dashboard/layout-permissions'
import { mergeLayoutWithCatalog, parseStoredLayout, resolvePlatformOrSystemDefault } from '@/lib/dashboard/widget-catalog'
import { fetchDashboardLayoutOwnerId } from '@/lib/dashboard/layout-owner'

/**
 * Server-side function for fetching dashboard layout
 * Used in Server Components to avoid client-side data fetching
 *
 * @param supabase - Supabase client instance (from server)
 * @param userId - User ID to fetch layout for
 * @returns Promise with layout config and permissions
 */
export async function getDashboardLayoutAsync(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
): Promise<{
  widgets: WidgetConfig[]
  permissions: UserPermissions
}> {
  try {
    // Fetch user's module access permissions
    const { data: userAccessData, error: accessError } = await supabase
      .from('user_module_access')
      .select('module_id, enabled')
      .eq('user_id', userId)
      .eq('enabled', true)

    if (accessError) {
      throw new Error(`Failed to fetch permissions: ${accessError.message}`)
    }

    const enabledModuleIds = (userAccessData ?? []).map((a) => a.module_id)

    // Fetch core modules (mandatory for all clients, cannot be disabled)
    let coreModuleIds: string[] = []
    try {
      const { data: coreModules } = await supabase
        .from('modules')
        .select('id')
        .eq('is_core', true)
      coreModuleIds = (coreModules ?? []).map((m) => m.id)
    } catch {
      // Column may not exist yet during migration — treat as no core modules
      coreModuleIds = []
    }

    const permissions = createPermissions(enabledModuleIds, coreModuleIds)

    const layoutOwnerId = await fetchDashboardLayoutOwnerId(supabase, userId)

    const { data: layoutData } = await supabase
      .from('dashboard_layouts')
      .select('configuration')
      .eq('user_id', layoutOwnerId)
      .maybeSingle()

    const { data: platformRow } = await supabase
      .from('platform_dashboard_default')
      .select('configuration')
      .eq('id', 1)
      .maybeSingle()

    const platformLayout = parseStoredLayout(platformRow?.configuration)

    let layoutWidgets: WidgetConfig[]
    if (layoutData?.configuration) {
      layoutWidgets = mergeLayoutWithCatalog(parseStoredLayout(layoutData.configuration))
    } else {
      layoutWidgets = resolvePlatformOrSystemDefault(platformLayout)
    }

    // Strip any moduleId from home widgets so they are always shown regardless of module permissions.
    // "Inicio" is not a permissioned module — it is accessible to all authenticated users.
    layoutWidgets = layoutWidgets.map((w) => ({ ...w, moduleId: undefined }))

    // Filter widgets based on permissions
    const widgets = filterWidgetsByPermissions(layoutWidgets, permissions)

    return { widgets, permissions }
  } catch (error) {
    console.error('Error fetching dashboard layout:', error)
    // Return default layout with empty permissions
    return {
      widgets: resolvePlatformOrSystemDefault(null).filter((w) => w.visible),
      permissions: createPermissions([], []),
    }
  }
}
