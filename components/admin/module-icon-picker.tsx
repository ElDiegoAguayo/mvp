'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ICON_CATEGORIES,
  getIconLabel,
  getIconShape,
  getModuleIcon,
  iconMatchesSearch,
} from '@/lib/module-icons'
import { cn } from '@/lib/utils'

type ModuleIconPickerProps = {
  value: string
  onChange: (icon: string) => void
  iconShape?: string | null
}

export function ModuleIconPicker({ value, onChange, iconShape }: ModuleIconPickerProps) {
  const [iconSearch, setIconSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const shapeCfg = getIconShape(iconShape)

  const allCategories = useMemo(
    () => ['Todos', ...ICON_CATEGORIES.map((c) => c.label)],
    [],
  )

  const filteredCategories = useMemo(() => {
    return ICON_CATEGORIES.map((cat) => ({
      ...cat,
      icons: cat.icons.filter(
        (iconKey) =>
          iconMatchesSearch(iconKey, iconSearch) &&
          (activeCategory === 'Todos' || cat.label === activeCategory),
      ),
    })).filter((cat) => cat.icons.length > 0)
  }, [iconSearch, activeCategory])

  const totalMatches = filteredCategories.reduce((n, cat) => n + cat.icons.length, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Icono</Label>
        <span className="text-[11px] text-muted-foreground">{totalMatches} disponibles</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={iconSearch}
            onChange={(e) => setIconSearch(e.target.value)}
            placeholder="Buscar por nombre o tema (ej. cereza, bodega, clima)…"
            className="h-8 border-border bg-secondary pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                activeCategory === cat
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-border bg-secondary/30 p-3">
        {filteredCategories.map((cat) => (
          <div key={cat.label}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {cat.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cat.icons.map((iconKey) => {
                const Icon = getModuleIcon(iconKey)
                const isSelected = value === iconKey
                return (
                  <button
                    key={iconKey}
                    type="button"
                    title={`${iconKey} — ${getIconLabel(iconKey)}`}
                    onClick={() => onChange(iconKey)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center border transition-all',
                      shapeCfg.className,
                      isSelected
                        ? 'scale-110 border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {filteredCategories.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin resultados para &quot;{iconSearch}&quot;
          </p>
        )}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          Seleccionado: <span className="font-medium text-foreground">{value}</span>
          {' · '}
          {getIconLabel(value)}
        </p>
      )}
    </div>
  )
}
