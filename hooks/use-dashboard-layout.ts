/**
 * Hook for fetching and managing dashboard layout configuration (CLIENT COMPONENT)
 * Handles permission-aware layout loading on the client side
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WidgetConfig, DEFAULT_DASHBOARD_LAYOUT } from '@/lib/dashboard/widget-config'
import {
  createPermissions,
  UserPermissions,
  filterWidgetsByPermissions,
} from '@/lib/dashboard/layout-permissions'

interface UseDashboardLayoutResult {
  widgets: WidgetConfig[]
  permissions: UserPermissions
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch dashboard layout and user permissions
 *
 * Features:
 * - Fetches user module access permissions from Supabase
 * - Optionally loads custom layout configuration (future-proofing for admin customization)
 * - Falls back to default layout if no custom config exists
 * - Automatically filters widgets based on permissions
 *
 * @returns Layout config, permissions, loading state, and refetch function
 */
export function useDashboardLayout(userId: string): UseDashboardLayoutResult {
  const supabase = createClient()
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_DASHBOARD_LAYOUT)
  const [permissions, setPermissions] = useState<UserPermissions>(createPermissions([], []))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchLayout = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Step 1: Fetch user's module access permissions
      const { data: userAccessData, error: accessError } = await supabase
        .from('user_module_access')
        .select('module_id, enabled')
        .eq('user_id', userId)
        .eq('enabled', true)

      if (accessError) {
        throw new Error(`Failed to fetch permissions: ${accessError.message}`)
      }

      const enabledModuleIds = (userAccessData ?? []).map((a) => a.module_id)

      // Fetch core (mandatory) modules
      let coreModuleIds: string[] = []
      try {
        const { data: coreModules } = await supabase
          .from('modules')
          .select('id')
          .eq('is_core', true)
        coreModuleIds = (coreModules ?? []).map((m) => m.id)
      } catch {
        coreModuleIds = []
      }

      const userPermissions = createPermissions(enabledModuleIds, coreModuleIds)
      setPermissions(userPermissions)

      // Resolve the "inicio" core module for tagging home widgets
      const { data: inicioModule } = await supabase
        .from('modules')
        .select('id')
        .eq('slug', 'inicio')
        .maybeSingle()

      const homeModuleId = inicioModule?.id ?? null

      const tagHomeWidgets = (widgets: WidgetConfig[]) =>
        widgets.map((w) =>
          w.moduleId || !homeModuleId ? w : { ...w, moduleId: homeModuleId }
        )

      // Step 2: Try to fetch custom layout configuration (future feature)
      const { data: layoutData } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .eq('user_id', userId)
        .single()

      let layoutWidgets = DEFAULT_DASHBOARD_LAYOUT
      if (layoutData) {
        try {
          const parsedLayout = JSON.parse(layoutData.configuration as string) as WidgetConfig[]
          layoutWidgets = parsedLayout
        } catch (parseError) {
          console.warn('Failed to parse custom layout, using defaults:', parseError)
        }
      }

      layoutWidgets = tagHomeWidgets(layoutWidgets)

      // Step 3: Filter widgets based on permissions
      const filteredWidgets = filterWidgetsByPermissions(layoutWidgets, userPermissions)
      setWidgets(filteredWidgets)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      console.error('Dashboard layout fetch error:', error)
      // Fall back to default layout with no permissions
      setWidgets(DEFAULT_DASHBOARD_LAYOUT.filter((w) => w.visible))
    } finally {
      setIsLoading(false)
    }
  }, [userId, supabase])

  // Fetch layout on mount and when userId changes
  useEffect(() => {
    fetchLayout()
  }, [fetchLayout, userId])

  return {
    widgets,
    permissions,
    isLoading,
    error,
    refetch: fetchLayout,
  }
}
