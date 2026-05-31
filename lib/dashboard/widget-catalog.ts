import type { GridSize, WidgetConfig, WidgetType } from '@/lib/dashboard/widget-config'
import { DEFAULT_DASHBOARD_LAYOUT } from '@/lib/dashboard/widget-config'

export type HomeWidgetCatalogEntry = {
  type: WidgetType
  id: string
  title: string
  description: string
  defaultGridSize: GridSize
}

/** Widgets configurable on /dashboard (excludes global-only: ai-assistant, activity-heartbeat). */
export const HOME_WIDGET_CATALOG: HomeWidgetCatalogEntry[] = [
  {
    type: 'smart-alerts',
    id: 'widget-smart-alerts',
    title: 'Alertas inteligentes',
    description: 'Heladas, tipo de cambio, stock bajo y avisos de administración.',
    defaultGridSize: 'full',
  },
  {
    type: 'inputs-price',
    id: 'widget-inputs-price',
    title: 'Precios de insumos',
    description: 'Combustible y precios de referencia para insumos agrícolas.',
    defaultGridSize: 'sm',
  },
  {
    type: 'currency',
    id: 'widget-currency',
    title: 'Monedas',
    description: 'Conversor CLP / USD / EUR en tiempo real.',
    defaultGridSize: 'sm',
  },
  {
    type: 'sag-alerts',
    id: 'widget-sag-alerts',
    title: 'Alertas SAG',
    description: 'Normativa y alertas fitosanitarias del SAG.',
    defaultGridSize: 'sm',
  },
  {
    type: 'weather',
    id: 'widget-weather',
    title: 'Clima',
    description: 'Condiciones meteorológicas para decisiones de campo.',
    defaultGridSize: 'sm',
  },
  {
    type: 'port-map',
    id: 'widget-port-map',
    title: 'Mapa de puertos',
    description: 'Visualización de puertos de embarque.',
    defaultGridSize: 'md',
  },
  {
    type: 'market',
    id: 'widget-market',
    title: 'Mercado',
    description: 'Resumen de precios de fruta exportada.',
    defaultGridSize: 'sm',
  },
  {
    type: 'ship-tracker',
    id: 'widget-ship-tracker',
    title: 'Rastreo satelital',
    description: 'Seguimiento de embarques por contenedor o booking.',
    defaultGridSize: 'md',
  },
  {
    type: 'document-vault',
    id: 'widget-document-vault',
    title: 'Bóveda documental',
    description: 'Acceso rápido a documentos recientes de la bóveda.',
    defaultGridSize: 'full',
  },
]

export function buildDefaultHomeLayout(): WidgetConfig[] {
  const defaultByType = new Map(DEFAULT_DASHBOARD_LAYOUT.map((w) => [w.type, w]))

  return HOME_WIDGET_CATALOG.map((entry, index) => {
    const fromDefault = defaultByType.get(entry.type)
    return {
      id: entry.id,
      type: entry.type,
      title: entry.title,
      gridSize: fromDefault?.gridSize ?? entry.defaultGridSize,
      order: fromDefault?.order ?? index,
      visible: fromDefault?.visible ?? false,
    }
  }).sort((a, b) => a.order - b.order)
}

export function parseStoredLayout(raw: unknown): WidgetConfig[] | null {
  if (!raw) return null
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return null
    return parsed as WidgetConfig[]
  } catch {
    return null
  }
}

/** Merge saved layout with catalog so new widgets appear when we add them later. */
export function mergeLayoutWithCatalog(saved: WidgetConfig[] | null): WidgetConfig[] {
  const defaults = buildDefaultHomeLayout()
  if (!saved?.length) return defaults

  const savedById = new Map(saved.map((w) => [w.id, w]))
  const savedByType = new Map(saved.map((w) => [w.type, w]))

  const merged = HOME_WIDGET_CATALOG.map((entry, index) => {
    const existing = savedById.get(entry.id) ?? savedByType.get(entry.type)
    if (existing) {
      return {
        ...existing,
        id: entry.id,
        type: entry.type,
        title: entry.title,
      }
    }
    return {
      id: entry.id,
      type: entry.type,
      title: entry.title,
      gridSize: entry.defaultGridSize,
      order: defaults.length + index,
      visible: false,
    }
  })

  return merged.sort((a, b) => a.order - b.order)
}

/** Plantilla de plataforma guardada, o default del código si no hay plantilla. */
export function resolvePlatformOrSystemDefault(platformLayout: WidgetConfig[] | null): WidgetConfig[] {
  if (platformLayout?.length) {
    return mergeLayoutWithCatalog(platformLayout)
  }
  return buildDefaultHomeLayout()
}

export function normalizeLayoutOrders(widgets: WidgetConfig[]): WidgetConfig[] {
  return widgets
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((widget, index) => ({ ...widget, order: index }))
}

export function validateLayoutForSave(widgets: WidgetConfig[]): { ok: boolean; message?: string } {
  const allowedTypes = new Set(HOME_WIDGET_CATALOG.map((w) => w.type))
  const allowedIds = new Set(HOME_WIDGET_CATALOG.map((w) => w.id))

  for (const widget of widgets) {
    if (!allowedIds.has(widget.id)) {
      return { ok: false, message: `Widget no permitido: ${widget.id}` }
    }
    if (!allowedTypes.has(widget.type)) {
      return { ok: false, message: `Tipo de widget no permitido: ${widget.type}` }
    }
  }

  const visibleCount = widgets.filter((w) => w.visible).length
  if (visibleCount === 0) {
    return { ok: false, message: 'Debe haber al menos un widget visible.' }
  }

  return { ok: true }
}
