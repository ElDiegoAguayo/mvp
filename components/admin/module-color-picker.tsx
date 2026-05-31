'use client'

import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { MODULE_COLOR_OPTIONS, isHexColor } from '@/lib/module-icons'
import { cn } from '@/lib/utils'

export interface ModuleColorPickerProps {
  label: string
  sublabel?: string
  value: string
  onChange: (v: string) => void
  nullable?: boolean
}

export function ModuleColorPicker({
  label,
  sublabel,
  value,
  onChange,
  nullable,
}: ModuleColorPickerProps) {
  const isCustom = isHexColor(value)
  const [hexInput, setHexInput] = useState(isCustom ? value : '#3b82f6')

  useEffect(() => {
    if (isHexColor(value)) setHexInput(value)
  }, [value])

  const applyHex = (raw: string) => {
    const clean = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(clean)
      setHexInput(clean)
    } else {
      setHexInput(raw)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {sublabel && <p className="-mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      <div className="flex flex-wrap gap-1.5">
        {nullable && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-all',
              value === '' || value == null
                ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                : 'border-border bg-secondary text-muted-foreground hover:border-primary/30',
            )}
          >
            Igual que icono
          </button>
        )}
        {MODULE_COLOR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-all',
              value === opt.value
                ? cn(opt.bg, opt.text, opt.border, 'shadow-sm')
                : 'border-border bg-secondary text-muted-foreground hover:border-primary/30',
            )}
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', opt.dot)} />
            {opt.label}
          </button>
        ))}
      </div>
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border p-2.5 transition-all',
          isCustom ? 'border-primary bg-primary/5' : 'border-border bg-secondary/40',
        )}
      >
        <Palette className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-xs text-muted-foreground">Personalizado:</span>
        <input
          type="color"
          value={isCustom ? value : isHexColor(hexInput) ? hexInput : '#3b82f6'}
          onChange={(e) => {
            setHexInput(e.target.value)
            onChange(e.target.value)
          }}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={isCustom ? value : hexInput}
          onChange={(e) => applyHex(e.target.value)}
          placeholder="#3b82f6"
          maxLength={7}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
        {isCustom && (
          <span className="shrink-0 text-[10px] font-semibold text-primary">Activo</span>
        )}
      </div>
    </div>
  )
}
