'use client'

import { useState, useMemo } from 'react'
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
import { Loader2, Plus } from 'lucide-react'
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

interface CreateModuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void | Promise<void>
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CreateModuleDialog({ open, onOpenChange, onCreated }: CreateModuleDialogProps) {
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
  const [slugTouched, setSlugTouched] = useState(false)

  const PreviewIcon = getModuleIcon(icon)
  const shapeCfg = getIconShape(iconShape)
  const iconContainerStyle = resolveIconContainerStyle(color, shapeCfg.className, iconStyle)
  const iconColorStyle = resolveIconStyle(color, iconStyle)
  const textColorStyle = resolveTextStyle(textColor || null, color)

  const handleNameChange = (val: string) => {
    setName(val)
    if (!slugTouched) setSlug(slugify(val))
  }

  const reset = () => {
    setName('')
    setSlug('')
    setIcon('Package')
    setColor('blue')
    setTextColor('')
    setIconShape('rounded')
    setIconSize('md')
    setIconStyle('soft')
    setMenuBadge('')
    setDescription('')
    setEmbedUrl('')
    setAreaId(null)
    setSlugTouched(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) {
      toast.error('Completa el nombre y el slug del modulo')
      return
    }
    setIsSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Debes iniciar sesion')
      setIsSaving(false)
      return
    }

    const { data: inserted, error } = await supabase
      .from('modules')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
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
        user_id: user.id,
        is_active: true,
      })
      .select('id, name, slug')
      .single()

    setIsSaving(false)
    if (error) {
      toast.error('No se pudo crear el modulo', { description: error.message })
      return
    }

    toast.success('Modulo creado', { description: `"${name}" ya esta disponible.` })
    await logAudit(supabase, {
      action_type: 'CREATE_MODULE',
      target_type: 'module',
      target_id: inserted?.id ?? null,
      target_label: inserted?.name ?? name.trim(),
      description: `Creo el modulo "${name.trim()}" (${slug.trim()}).`,
      metadata: {
        slug: slug.trim(),
        icon,
        color,
        text_color: textColor || null,
        icon_shape: iconShape,
        icon_size: iconSize,
        icon_style: iconStyle,
        menu_badge: menuBadge.trim() || null,
      },
    })
    await onCreated?.()
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isSaving) {
          if (!o) reset()
          onOpenChange(o)
        }
      }}
    >
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
                {name || 'Nuevo modulo'}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                Configura nombre, icono, colores y apariencia en el menú
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mod-name">Nombre</Label>
              <Input
                id="mod-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Finanzas"
                autoFocus
                disabled={isSaving}
                className="border-border bg-secondary"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-slug">Slug (URL)</Label>
              <Input
                id="mod-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(slugify(e.target.value))
                }}
                placeholder="finanzas"
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
            <Label htmlFor="mod-desc">
              Descripcion <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="mod-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Que hace este modulo..."
              rows={2}
              disabled={isSaving}
              className="resize-none border-border bg-secondary text-sm"
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
              className="min-w-[130px] gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Crear modulo
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
