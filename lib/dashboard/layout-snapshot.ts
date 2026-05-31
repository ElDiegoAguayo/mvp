import type { WidgetConfig } from '@/lib/dashboard/widget-config'

/** Serializa layout para comparar si hubo cambios sin guardar. */
export function snapshotLayoutWidgets(widgets: WidgetConfig[]): string {
  return JSON.stringify(
    widgets
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => ({
        id: w.id,
        type: w.type,
        visible: w.visible,
        gridSize: w.gridSize,
        order: w.order,
      })),
  )
}

export function layoutWidgetsDirty(current: WidgetConfig[], baseline: string): boolean {
  if (!baseline) return false
  return snapshotLayoutWidgets(current) !== baseline
}
