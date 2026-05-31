/**
 * Dynamic Dashboard Layout Renderer
 * 
 * Renders widgets based on a configuration array, with support for:
 * - Dynamic widget loading via Component Dictionary
 * - Permission-aware filtering
 * - Responsive grid layout
 * - Error boundaries for individual widgets
 */

'use client'

import React from 'react'
import { WidgetConfig, GRID_SIZE_MAP } from '@/lib/dashboard/widget-config'
import { getWidgetComponent } from '@/lib/dashboard/component-map'
import {
  filterWidgetsByPermissions,
  UserPermissions,
} from '@/lib/dashboard/layout-permissions'
import { useLocale } from '@/components/i18n/locale-provider'

interface DashboardLayoutProps {
  /**
   * Array of widget configurations that define the layout
   */
  widgets: WidgetConfig[]

  /**
   * User permissions for filtering widgets
   * If not provided, all visible widgets will be rendered
   */
  permissions?: UserPermissions

  /**
   * Additional CSS classes for the grid container
   */
  containerClassName?: string
}

/**
 * Error boundary for individual widgets
 * Prevents one broken widget from crashing the entire dashboard
 */
class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode; widgetId: string; errorMessage: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; widgetId: string; errorMessage: string }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error(`Widget error (${this.props.widgetId}):`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="col-span-1 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{this.props.errorMessage}</p>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Dynamic Dashboard Layout Renderer
 *
 * Main component that:
 * 1. Filters widgets based on permissions
 * 2. Renders widgets in a responsive grid
 * 3. Handles missing components gracefully
 * 4. Provides error boundaries for individual widgets
 *
 * Example usage:
 * ```tsx
 * const permissions = createPermissions(enabledModuleIds)
 * <DashboardLayout
 *   widgets={DEFAULT_DASHBOARD_LAYOUT}
 *   permissions={permissions}
 * />
 * ```
 */
export function DashboardLayout({
  widgets,
  permissions,
  containerClassName = '',
}: DashboardLayoutProps) {
  const { t } = useLocale()
  // Filter widgets based on permissions
  const visibleWidgets = (permissions
    ? filterWidgetsByPermissions(widgets, permissions)
    : widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order)
  ).filter((w) => w.type !== 'ai-assistant')

  // Handle case when no widgets are visible
  if (visibleWidgets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          {t('homeWidgets.noWidgets')}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${containerClassName}`}
      role="main"
      aria-label="Dashboard layout"
    >
      {visibleWidgets.map((widgetConfig) => (
        <DashboardWidget key={widgetConfig.id} config={widgetConfig} t={t} />
      ))}
    </div>
  )
}

/**
 * Individual Widget Renderer
 * Handles:
 * - Component lookup
 * - Responsive grid sizing
 * - Error handling
 * - Props passing
 */
interface DashboardWidgetProps {
  config: WidgetConfig
  t: (key: string, params?: Record<string, string | number>) => string
}

function DashboardWidget({ config, t }: DashboardWidgetProps) {
  const Component = getWidgetComponent(config.type)

  // Handle missing component type
  if (!Component) {
    console.warn(`Widget type not found: ${config.type}`)
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-50/5 p-4 dark:bg-yellow-950/10">
        <p className="text-sm text-yellow-600 dark:text-yellow-500">
          {t('dashboard.widgetUnavailable', { type: config.type })}
        </p>
      </div>
    )
  }

  const gridClass = GRID_SIZE_MAP[config.gridSize]

  return (
    <div className={`${gridClass}`}>
      <WidgetErrorBoundary
        widgetId={config.id}
        errorMessage={t('dashboard.widgetLoadError', { id: config.id })}
      >
        <div className="h-full">
          <Component {...(config.props ?? {})} />
        </div>
      </WidgetErrorBoundary>
    </div>
  )
}

export default DashboardLayout
