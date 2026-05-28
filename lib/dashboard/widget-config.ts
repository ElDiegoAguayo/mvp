/**
 * Widget Configuration Types & Defaults
 * Defines the structure for dashboard layout configuration
 */

export type WidgetType =
  | 'smart-alerts'
  | 'inputs-price'
  | 'currency'
  | 'sag-alerts'
  | 'ai-assistant'
  | 'weather'
  | 'port-map'
  | 'activity-heartbeat'
  | 'document-vault'
  | 'market'
  | 'ship-tracker'

export type GridSize = 'sm' | 'md' | 'lg' | 'full'

export interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  gridSize: GridSize
  moduleId?: string // Optional: link to a module for permission checking
  order: number
  visible: boolean
  props?: Record<string, unknown>
}

export interface LayoutConfig {
  id: string
  name: string
  clientId: string
  widgets: WidgetConfig[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Default dashboard layout for new clients
 * This is the starting template that can be customized per client
 */
export const DEFAULT_DASHBOARD_LAYOUT: WidgetConfig[] = [
  // Row 1: full-width alerts banner
  {
    id: 'header-welcome',
    type: 'smart-alerts',
    title: 'Smart Alerts',
    gridSize: 'full',
    order: 0,
    visible: true,
  },
  // Row 2: three equal API cards side-by-side
  {
    id: 'widget-inputs-price',
    type: 'inputs-price',
    title: 'Precios de Insumos',
    gridSize: 'sm',
    order: 1,
    visible: true,
  },
  {
    id: 'widget-currency',
    type: 'currency',
    title: 'Monedas',
    gridSize: 'sm',
    order: 2,
    visible: true,
  },
  {
    id: 'widget-sag-alerts',
    type: 'sag-alerts',
    title: 'Alertas SAG',
    gridSize: 'sm',
    order: 3,
    visible: true,
  },
  // Row 3: full-width AI assistant
  {
    id: 'widget-ai-assistant',
    type: 'ai-assistant',
    title: 'Asistente IA',
    gridSize: 'full',
    order: 4,
    visible: true,
  },
]

/**
 * Map of grid sizes to Tailwind CSS grid column classes
 */
export const GRID_SIZE_MAP: Record<GridSize, string> = {
  sm: 'md:col-span-1',
  md: 'md:col-span-2',
  lg: 'md:col-span-3',
  full: 'md:col-span-3',
}
