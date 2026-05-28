'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save, Search, Palette } from 'lucide-react'
import {
  ICON_CATEGORIES,
  MODULE_COLOR_OPTIONS,
  ICON_SHAPE_OPTIONS,
  getModuleIcon,
  getModuleColor,
  getIconShape,
  isHexColor,
  resolveIconContainerStyle,
  resolveIconStyle,
  resolveTextStyle,
} from '@/lib/module-icons'
import { logAudit } from '@/lib/audit-log'
import { cn } from '@/lib/utils'

interface Module {
  id: string
  name: string
  slug: string
  icon: string | null
  color?: string | null
  text_color?: string | null
  icon_shape?: string | null
  description: string | null
  embed_url?: string | null
}

interface EditModuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  module: Module | null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Reusable color picker ─────────────────────────────────────────────────────
interface ColorPickerProps {
  label: string
  sublabel?: string
  value: string
  onChange: (v: string) => void
  nullable?: boolean
}

function ColorPicker({ label, sublabel, value, onChange, nullable }: ColorPickerProps) {
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
      {sublabel && <p className="text-xs text-muted-foreground -mt-1">{sublabel}</p>}
      <div className="flex flex-wrap gap-1.5">
        {nullable && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              value === '' || value == null
                ? 'bg-primary/10 text-primary border-primary/40 shadow-sm'
                : 'bg-secondary text-muted-foreground border-border hover:border-primary/30'
            )}
          >
            Igual que icono
          </button>
        )}
        {MODULE_COLOR_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              value === opt.value
                ? cn(opt.bg, opt.text, opt.border, 'shadow-sm')
                : 'bg-secondary text-muted-foreground border-border hover:border-primary/30'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', opt.dot)} />
            {opt.label}
          </button>
        ))}
      </div>
      <div className={cn(
        'flex items-center gap-2 p-2.5 rounded-xl border transition-all',
        isCustom ? 'border-primary bg-primary/5' : 'border-border bg-secondary/40'
      )}>
        <Palette className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0">Personalizado:</span>
        <input
          type="color"
          value={isCustom ? value : (isHexColor(hexInput) ? hexInput : '#3b82f6')}
          onChange={(e) => { setHexInput(e.target.value); onChange(e.target.value) }}
          className="w-8 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
        />
        <input
          type="text"
          value={isCustom ? value : hexInput}
          onChange={(e) => applyHex(e.target.value)}
          placeholder="#3b82f6"
          maxLength={7}
          className="flex-1 min-w-0 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
        />
        {isCustom && <span className="text-[10px] text-primary font-semibold shrink-0">Activo</span>}
      </div>
    </div>
  )
}

// ─── Main dialog ───────────────────────────────────────────────────────────────
export function EditModuleDialog({ open, onOpenChange, module }: EditModuleDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [icon, setIcon] = useState('Package')
  const [color, setColor] = useState('blue')
  const [textColor, setTextColor] = useState('')
  const [iconShape, setIconShape] = useState('rounded')
  const [description, setDescription] = useState('')
  const [embedUrl, setEmbedUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [iconSearch, setIconSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')

  useEffect(() => {
    if (module) {
      setName(module.name)
      setSlug(module.slug)
      setIcon(module.icon || 'Package')
      setColor(module.color || 'blue')
      setTextColor(module.text_color || '')
      setIconShape(module.icon_shape || 'rounded')
      setDescription(module.description || '')
      setEmbedUrl(module.embed_url || '')
      setIconSearch('')
      setActiveCategory('Todos')
    }
  }, [module])

  const PreviewIcon = getModuleIcon(icon)
  const shapeCfg = getIconShape(iconShape)
  const iconContainerStyle = resolveIconContainerStyle(color, shapeCfg.className)
  const iconColorStyle = resolveIconStyle(color)
  const textColorStyle = resolveTextStyle(textColor || null, color)

  const allCategories = ['Todos', ...ICON_CATEGORIES.map(c => c.label)]

  const filteredCategories = useMemo(() => {
    const q = iconSearch.toLowerCase()
    return ICON_CATEGORIES
      .map(cat => ({
        ...cat,
        icons: cat.icons.filter(i =>
          (!q || i.toLowerCase().includes(q)) &&
          (activeCategory === 'Todos' || cat.label === activeCategory)
        ),
      }))
      .filter(cat => cat.icons.length > 0)
  }, [iconSearch, activeCategory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!module) return
    if (!name.trim() || !slug.trim()) { toast.error('Completa el nombre y el slug'); return }
    setIsSaving(true)

    const { error } = await supabase
      .from('modules')
      .update({
        name: name.trim(),
        slug: slugify(slug),
        icon,
        color,
        text_color: textColor || null,
        icon_shape: iconShape,
        description: description.trim() || null,
        embed_url: embedUrl.trim() || null,
      })
      .eq('id', module.id)

    setIsSaving(false)
    if (error) { toast.error('No se pudo actualizar', { description: error.message }); return }

    toast.success('Modulo actualizado', { description: `"${name.trim()}" guardado.` })
    await logAudit(supabase, {
      action_type: 'UPDATE_MODULE', target_type: 'module',
      target_id: module.id, target_label: name.trim(),
      description: `Actualizo el modulo "${module.name}" a "${name.trim()}".`,
      metadata: { icon, color, text_color: textColor || null, icon_shape: iconShape },
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSaving) onOpenChange(o) }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border">

        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-5 border-b border-border">
          <div className="flex items-center gap-4">
            <div
              className={cn('w-12 h-12 flex items-center justify-center flex-shrink-0 shadow-sm transition-all duration-200', iconContainerStyle.className)}
              style={iconContainerStyle.style}
            >
              <PreviewIcon className={iconColorStyle.className} style={{ ...iconColorStyle.style, width: 24, height: 24 }} />
            </div>
            <div className="min-w-0">
              <DialogTitle
                className={cn('text-xl font-bold tracking-tight transition-colors', textColorStyle.className)}
                style={textColorStyle.style}
              >
                {name || 'Editar modulo'}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                Modifica icono, colores, forma y URL
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-6">

          {/* Nombre + Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)}
                autoFocus disabled={isSaving} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-slug">Slug (URL)</Label>
              <Input id="edit-slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))}
                disabled={isSaving} className="bg-secondary border-border font-mono text-sm" />
              <p className="text-[11px] text-muted-foreground font-mono">/dashboard/{slug || 'mi-modulo'}</p>
            </div>
          </div>

          {/* Color del icono + Forma */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-start">
            <ColorPicker
              label="Color del icono"
              sublabel="Color del fondo y el icono en el menu"
              value={color}
              onChange={setColor}
            />
            <div className="space-y-2">
              <Label>Forma</Label>
              <p className="text-xs text-muted-foreground -mt-1">Estilo del contenedor</p>
              <div className="flex gap-2">
                {ICON_SHAPE_OPTIONS.map(opt => {
                  const isActive = iconShape === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIconShape(opt.value)}
                      title={opt.label}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-2.5 border rounded-xl transition-all w-16',
                        isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      <div className={cn('w-8 h-8 border-2 flex items-center justify-center', opt.className,
                        isActive ? cn(getModuleColor(isHexColor(color) ? 'blue' : color).bg, getModuleColor(isHexColor(color) ? 'blue' : color).border) : 'border-current bg-current/10'
                      )}>
                        <PreviewIcon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-medium">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Color del texto */}
          <ColorPicker
            label="Color del texto"
            sublabel="Color del nombre del modulo en el menu lateral"
            value={textColor}
            onChange={setTextColor}
            nullable
          />

          {/* Icono */}
          <div className="space-y-2">
            <Label>Icono</Label>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input value={iconSearch} onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Buscar icono..." className="pl-8 h-8 text-sm bg-secondary border-border" />
              </div>
              <div className="flex gap-1 flex-wrap">
                {allCategories.map(cat => (
                  <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                    className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-all border',
                      activeCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                    )}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="border border-border rounded-xl bg-secondary/30 p-3 max-h-52 overflow-y-auto space-y-3">
              {filteredCategories.map(cat => (
                <div key={cat.label}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{cat.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.icons.map(iconKey => {
                      const Icon = getModuleIcon(iconKey)
                      const isSelected = icon === iconKey
                      return (
                        <button key={iconKey} type="button" title={iconKey} onClick={() => setIcon(iconKey)}
                          className={cn('w-9 h-9 flex items-center justify-center border transition-all', shapeCfg.className,
                            isSelected ? 'shadow-sm scale-110 border-primary bg-primary/10 text-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                          )}>
                          <Icon className="w-4 h-4" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {filteredCategories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sin resultados para "{iconSearch}"</p>
              )}
            </div>
          </div>

          {/* Descripcion */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Descripcion <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} disabled={isSaving} className="bg-secondary border-border resize-none text-sm" />
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-secondary/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={cn('w-7 h-7 border flex items-center justify-center flex-shrink-0', iconContainerStyle.className)}
              style={iconContainerStyle.style}
            >
              <PreviewIcon className={iconColorStyle.className} style={{ ...iconColorStyle.style, width: 14, height: 14 }} />
            </div>
            <span className={cn('text-sm font-semibold', textColorStyle.className)} style={textColorStyle.style}>
              {name || 'Sin nombre'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving || !name.trim() || !slug.trim()} className="min-w-[140px] gap-1.5">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />Guardar cambios</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
