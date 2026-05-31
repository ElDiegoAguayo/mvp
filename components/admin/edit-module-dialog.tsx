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
import { Loader2, Save } from 'lucide-react'
import {
  getModuleIcon,
  getIconShape,
  resolveIconContainerStyle,
  resolveIconStyle,
  resolveTextStyle,
  type IconSize,
  type IconShape,
  type IconStyle,
} from '@/lib/module-icons'
import { logAudit } from '@/lib/audit-log'
import { cn } from '@/lib/utils'
import { ModuleAreaSelect } from './module-area-select'
import { ModuleColorPicker } from './module-color-picker'
import { ModuleIconPicker } from './module-icon-picker'
import { ModuleAppearanceSettings } from './module-appearance-settings'

interface Module {
  id: string
  name: string
  slug: string
  icon: string | null
  color?: string | null
  text_color?: string | null
  icon_shape?: string | null
  icon_size?: string | null
  icon_style?: string | null
  menu_badge?: string | null
  description: string | null
  embed_url?: string | null
  area_id?: string | null
}

interface EditModuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  module: Module | null
  onSaved?: () => void
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function EditModuleDialog({ open, onOpenChange, module, onSaved }: EditModuleDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [icon, setIcon] = useState('Package')
  const [color, setColor] = useState('blue')
  const [textColor, setTextColor] = useState('')
  const [iconShape, setIconShape] = useState<IconShape>('rounded')
  const [iconSize, setIconSize] = useState<IconSize>('md')
  const [iconStyle, setIconStyle] = useState<IconStyle>('soft')
  const [menuBadge, setMenuBadge] = useState('')
  const [description, setDescription] = useState('')
  const [embedUrl, setEmbedUrl] = useState('')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (module) {
      setName(module.name)
      setSlug(module.slug)
      setIcon(module.icon || 'Package')
      setColor(module.color || 'blue')
      setTextColor(module.text_color || '')
      setIconShape((module.icon_shape as IconShape) || 'rounded')
      setIconSize((module.icon_size as IconSize) || 'md')
      setIconStyle((module.icon_style as IconStyle) || 'soft')
      setMenuBadge(module.menu_badge || '')
      setDescription(module.description || '')
      setEmbedUrl(module.embed_url || '')
      setAreaId(module.area_id ?? null)
    }
  }, [module])

  const PreviewIcon = getModuleIcon(icon)
  const shapeCfg = getIconShape(iconShape)
  const iconContainerStyle = resolveIconContainerStyle(color, shapeCfg.className, iconStyle)
  const iconColorStyle = resolveIconStyle(color, iconStyle)
  const textColorStyle = resolveTextStyle(textColor || null, color)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!module) return
    if (!name.trim() || !slug.trim()) {
      toast.error('Completa el nombre y el slug')
      return
    }
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
        icon_size: iconSize,
        icon_style: iconStyle,
        menu_badge: menuBadge.trim() || null,
        description: description.trim() || null,
        embed_url: embedUrl.trim() || null,
        area_id: areaId,
      })
      .eq('id', module.id)

    setIsSaving(false)
    if (error) {
      toast.error('No se pudo actualizar', { description: error.message })
      return
    }

    toast.success('Modulo actualizado', { description: `"${name.trim()}" guardado.` })
    await logAudit(supabase, {
      action_type: 'UPDATE_MODULE',
      target_type: 'module',
      target_id: module.id,
      target_label: name.trim(),
      description: `Actualizo el modulo "${module.name}" a "${name.trim()}".`,
      metadata: {
        icon,
        color,
        text_color: textColor || null,
        icon_shape: iconShape,
        icon_size: iconSize,
        icon_style: iconStyle,
        menu_badge: menuBadge.trim() || null,
      },
    })
    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSaving) onOpenChange(o) }}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] flex-col gap-0 overflow-hidden border-border bg-background p-0 sm:max-w-3xl">
        <div className="flex-shrink-0 border-b border-border px-6 pb-5 pt-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-12 w-12 flex-shrink-0 items-center justify-center shadow-sm transition-all duration-200',
                iconContainerStyle.className,
              )}
              style={iconContainerStyle.style}
            >
              <PreviewIcon
                className={iconColorStyle.className}
                style={{ ...iconColorStyle.style, width: 24, height: 24 }}
              />
            </div>
            <div className="min-w-0">
              <DialogTitle
                className={cn('text-xl font-bold tracking-tight transition-colors', textColorStyle.className)}
                style={textColorStyle.style}
              >
                {name || 'Editar modulo'}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                Icono, colores, apariencia en menú y URL embebida
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={isSaving}
                className="border-border bg-secondary"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-slug">Slug (URL)</Label>
              <Input
                id="edit-slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                disabled={isSaving}
                className="border-border bg-secondary font-mono text-sm"
              />
              <p className="font-mono text-[11px] text-muted-foreground">/dashboard/{slug || 'mi-modulo'}</p>
            </div>
          </div>

          <ModuleAreaSelect value={areaId} onChange={setAreaId} disabled={isSaving} />

          <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
            <ModuleColorPicker
              label="Color del icono"
              sublabel="Color del fondo y el icono en el menu"
              value={color}
              onChange={setColor}
            />
            <ModuleColorPicker
              label="Color del texto"
              sublabel="Color del nombre del modulo en el menu lateral"
              value={textColor}
              onChange={setTextColor}
              nullable
            />
          </div>

          <ModuleAppearanceSettings
            icon={icon}
            color={color}
            iconShape={iconShape}
            iconSize={iconSize}
            iconStyle={iconStyle}
            menuBadge={menuBadge}
            onIconShapeChange={setIconShape}
            onIconSizeChange={setIconSize}
            onIconStyleChange={setIconStyle}
            onMenuBadgeChange={setMenuBadge}
            disabled={isSaving}
          />

          <ModuleIconPicker value={icon} onChange={setIcon} iconShape={iconShape} />

          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">
              Descripcion <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={isSaving}
              className="resize-none border-border bg-secondary text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-embed">
              URL embebida <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="edit-embed"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              disabled={isSaving}
              placeholder="https://…"
              className="border-border bg-secondary text-sm"
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-border bg-secondary/20 px-6 py-4">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 flex-shrink-0 items-center justify-center border',
                iconContainerStyle.className,
              )}
              style={iconContainerStyle.style}
            >
              <PreviewIcon
                className={iconColorStyle.className}
                style={{ ...iconColorStyle.style, width: 14, height: 14 }}
              />
            </div>
            <span
              className={cn('text-sm font-semibold', textColorStyle.className)}
              style={textColorStyle.style}
            >
              {name || 'Sin nombre'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !name.trim() || !slug.trim()}
              className="min-w-[140px] gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
