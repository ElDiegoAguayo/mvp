'use client'

import type { GridSize, WidgetConfig } from '@/lib/dashboard/widget-config'
import { GRID_SIZE_MAP } from '@/lib/dashboard/widget-config'
import { cn } from '@/lib/utils'
import { LayoutGrid } from 'lucide-react'

const GRID_SIZE_LABELS: Record<GridSize, string> = {
  sm: '1 col',
  md: '2 cols',
  lg: '3 cols',
  full: 'Ancho completo',
}

const WIDGET_COLORS: Partial<Record<WidgetConfig['type'], string>> = {
  'smart-alerts': 'border-primary/40 bg-primary/5',
  'inputs-price': 'border-emerald-500/30 bg-emerald-500/5',
  currency: 'border-sky-500/30 bg-sky-500/5',
  'sag-alerts': 'border-amber-500/30 bg-amber-500/5',
  weather: 'border-cyan-500/30 bg-cyan-500/5',
  'port-map': 'border-indigo-500/30 bg-indigo-500/5',
  market: 'border-orange-500/30 bg-orange-500/5',
  'ship-tracker': 'border-violet-500/30 bg-violet-500/5',
  'document-vault': 'border-rose-500/30 bg-rose-500/5',
}

export function DashboardLayoutPreview({ widgets }: { widgets: WidgetConfig[] }) {
  const visible = widgets
    .filter((w) => w.visible)
    .slice()
    .sort((a, b) => a.order - b.order)

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <LayoutGrid className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Sin widgets visibles</p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Activa al menos un widget para ver la vista previa del Inicio.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vista previa · Inicio
        </p>
        <span className="text-xs text-muted-foreground">
          {visible.length} widget{visible.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {visible.map((widget) => (
          <div
            key={widget.id}
            className={cn(
              'flex min-h-[4.5rem] flex-col justify-center rounded-lg border px-3 py-2.5 transition-colors',
              GRID_SIZE_MAP[widget.gridSize],
              WIDGET_COLORS[widget.type] ?? 'border-border bg-card',
            )}
          >
            <p className="truncate text-sm font-medium text-foreground">{widget.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {GRID_SIZE_LABELS[widget.gridSize]}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
