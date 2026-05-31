'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Loader2 } from 'lucide-react'
import type { GridSize, WidgetConfig } from '@/lib/dashboard/widget-config'
import { HOME_WIDGET_CATALOG } from '@/lib/dashboard/widget-catalog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const GRID_SIZE_LABELS: Record<GridSize, string> = {
  sm: 'Pequeño (1 col)',
  md: 'Mediano (2 cols)',
  lg: 'Grande (3 cols)',
  full: 'Ancho completo',
}

function catalogDescription(type: WidgetConfig['type']): string {
  return HOME_WIDGET_CATALOG.find((w) => w.type === type)?.description ?? ''
}

function reorderWidgets(widgets: WidgetConfig[], fromId: string, toId: string): WidgetConfig[] {
  const ordered = widgets.slice().sort((a, b) => a.order - b.order)
  const fromIndex = ordered.findIndex((w) => w.id === fromId)
  const toIndex = ordered.findIndex((w) => w.id === toId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return widgets

  const next = ordered.slice()
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next.map((w, i) => ({ ...w, order: i }))
}

export function DashboardWidgetEditor({
  widgets,
  loading,
  onChange,
}: {
  widgets: WidgetConfig[]
  loading: boolean
  onChange: (widgets: WidgetConfig[]) => void
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const sortedWidgets = widgets.slice().sort((a, b) => a.order - b.order)
  const visibleCount = sortedWidgets.filter((w) => w.visible).length
  const allVisible = visibleCount === sortedWidgets.length
  const noneVisible = visibleCount === 0

  const setAllVisible = (visible: boolean) => {
    onChange(widgets.map((w) => ({ ...w, visible })))
  }

  const updateWidget = (id: string, patch: Partial<WidgetConfig>) => {
    onChange(widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }

  const moveWidget = (id: string, direction: -1 | 1) => {
    const ordered = sortedWidgets.slice()
    const index = ordered.findIndex((w) => w.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordered.length) return
    onChange(reorderWidgets(widgets, ordered[index].id, ordered[target].id))
  }

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return
    onChange(reorderWidgets(widgets, draggingId, targetId))
    setDraggingId(null)
    setDragOverId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Arrastra el icono <GripVertical className="inline h-3.5 w-3.5 align-text-bottom" /> para
          reordenar, o usa las flechas.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={allVisible}
            onClick={() => setAllVisible(true)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Activar todos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={noneVisible}
            onClick={() => setAllVisible(false)}
          >
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            Ocultar todos
          </Button>
        </div>
      </div>
      {sortedWidgets.map((widget, index) => (
        <Card
          key={widget.id}
          className={cn(
            'transition-all',
            !widget.visible && 'opacity-60',
            draggingId === widget.id && 'scale-[0.98] opacity-50',
            dragOverId === widget.id && draggingId !== widget.id && 'ring-2 ring-primary/40',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverId(widget.id)
          }}
          onDragLeave={() => {
            if (dragOverId === widget.id) setDragOverId(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(widget.id)
          }}
        >
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <button
                type="button"
                draggable
                onDragStart={() => setDraggingId(widget.id)}
                onDragEnd={() => {
                  setDraggingId(null)
                  setDragOverId(null)
                }}
                className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                aria-label={`Reordenar ${widget.title}`}
              >
                <GripVertical className="h-4 w-4 shrink-0" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{widget.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    #{index + 1}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{catalogDescription(widget.type)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:justify-end">
              <div className="flex items-center gap-2">
                <Switch
                  checked={widget.visible}
                  onCheckedChange={(checked) => updateWidget(widget.id, { visible: checked })}
                  aria-label={`Mostrar ${widget.title}`}
                />
                <span className="text-sm text-muted-foreground">Visible</span>
              </div>

              <div className="w-[180px]">
                <Select
                  value={widget.gridSize}
                  onValueChange={(value) => updateWidget(widget.id, { gridSize: value as GridSize })}
                  disabled={!widget.visible}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GRID_SIZE_LABELS) as GridSize[]).map((size) => (
                      <SelectItem key={size} value={size}>
                        {GRID_SIZE_LABELS[size]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => moveWidget(widget.id, -1)}
                  disabled={index === 0}
                  aria-label="Subir"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => moveWidget(widget.id, 1)}
                  disabled={index === sortedWidgets.length - 1}
                  aria-label="Bajar"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
