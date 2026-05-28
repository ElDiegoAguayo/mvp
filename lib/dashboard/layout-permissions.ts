/**
 * Permission-aware layout utilities
 * Handles filtering widgets based on user permissions
 */

import { WidgetConfig } from './widget-config'

export interface UserPermissions {
  enabledModuleIds: string[]
  coreModuleIds: string[]
  hasAccess: (moduleId?: string) => boolean
}

/**
 * Filter widgets based on:
 * 1. Widget visibility flag
 * 2. Module-based permissions (if moduleId is set)
 * 3. Module being active/enabled
 *
 * Returns widgets in their configured order
 */
export function filterWidgetsByPermissions(
  widgets: WidgetConfig[],
  permissions: UserPermissions,
): WidgetConfig[] {
  return widgets
    .filter((widget) => {
      // Check if widget is marked as visible
      if (!widget.visible) return false

      // If widget has a moduleId, check if user has access to that module
      if (widget.moduleId) {
        return permissions.hasAccess(widget.moduleId)
      }

      // Widgets without moduleId are always shown (if visible)
      return true
    })
    .sort((a, b) => a.order - b.order)
}

/**
 * Get permission object from user_module_access data
 * Simplifies permission checking throughout the app
 */
export function createPermissions(
  enabledModuleIds: string[],
  coreModuleIds: string[] = []
): UserPermissions {
  return {
    enabledModuleIds,
    coreModuleIds,
    hasAccess: (moduleId?: string) => {
      if (!moduleId) return true
      // Core modules are always accessible (mandatory for all clients)
      if (coreModuleIds.includes(moduleId)) return true
      return enabledModuleIds.includes(moduleId)
    },
  }
}

/**
 * Apply default visibility rules to widgets
 * Useful when loading saved configurations that might have outdated visibility
 */
export function applyVisibilityRules(
  widgets: WidgetConfig[],
  visibilityRules?: Record<string, boolean>,
): WidgetConfig[] {
  if (!visibilityRules) return widgets

  return widgets.map((widget) => ({
    ...widget,
    visible: visibilityRules[widget.id] !== undefined ? visibilityRules[widget.id] : widget.visible,
  }))
}

/**
 * Validate a widget configuration
 * Ensures all required fields are present and valid
 */
export function validateWidgetConfig(widget: WidgetConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!widget.id) errors.push('Widget must have an id')
  if (!widget.type) errors.push('Widget must have a type')
  if (!widget.title) errors.push('Widget must have a title')
  if (widget.order === undefined || widget.order < 0) {
    errors.push('Widget must have a valid order (>= 0)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
