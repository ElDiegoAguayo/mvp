'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  ICON_SHAPE_OPTIONS,
  ICON_SIZE_OPTIONS,
  ICON_STYLE_OPTIONS,
  MENU_BADGE_PRESETS,
  getIconShape,
  getModuleColor,
  getModuleIcon,
  isHexColor,
  resolveIconContainerStyle,
  resolveIconStyle,
  type IconSize,
  type IconShape,
  type IconStyle,
} from '@/lib/module-icons'
import { cn } from '@/lib/utils'

type ModuleAppearanceSettingsProps = {
  icon: string
  color: string
  iconShape: string
  iconSize: string
  iconStyle: string
  menuBadge: string
  onIconShapeChange: (v: IconShape) => void
  onIconSizeChange: (v: IconSize) => void
  onIconStyleChange: (v: IconStyle) => void
  onMenuBadgeChange: (v: string) => void
  disabled?: boolean
}

export function ModuleAppearanceSettings({
  icon,
  color,
  iconShape,
  iconSize,
  iconStyle,
  menuBadge,
  onIconShapeChange,
  onIconSizeChange,
  onIconStyleChange,
  onMenuBadgeChange,
  disabled = false,
}: ModuleAppearanceSettingsProps) {
  const PreviewIcon = getModuleIcon(icon)
  const shapeCfg = getIconShape(iconShape)
  const sizeCfg = ICON_SIZE_OPTIONS.find((s) => s.value === iconSize) ?? ICON_SIZE_OPTIONS[1]
  const presetColor = isHexColor(color) ? 'blue' : color
  const colorCfg = getModuleColor(presetColor)
  const containerPreview = resolveIconContainerStyle(color, shapeCfg.className, iconStyle)
  const iconPreview = resolveIconStyle(color, iconStyle)

  return (
    <div className="space-y-5 rounded-xl border border-border bg-secondary/20 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Apariencia en el menú</p>
        <p className="text-xs text-muted-foreground">
          Forma, tamaño, estilo del icono y etiqueta opcional junto al nombre.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Forma del contenedor</Label>
          <div className="flex flex-wrap gap-2">
            {ICON_SHAPE_OPTIONS.map((opt) => {
              const isActive = iconShape === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onIconShapeChange(opt.value)}
                  title={opt.label}
                  className={cn(
                    'flex w-16 flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center border-2',
                      opt.className,
                      isActive ? cn(colorCfg.bg, colorCfg.border) : 'border-current bg-current/10',
                    )}
                  >
                    <PreviewIcon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-medium">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tamaño del icono</Label>
          <div className="flex flex-wrap gap-2">
            {ICON_SIZE_OPTIONS.map((opt) => {
              const isActive = iconSize === opt.value
              const previewContainer = resolveIconContainerStyle(
                color,
                shapeCfg.className,
                iconStyle,
              )
              const previewIcon = resolveIconStyle(color, iconStyle)
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onIconSizeChange(opt.value)}
                  className={cn(
                    'flex min-w-[5.5rem] flex-col items-center gap-2 rounded-xl border px-3 py-2.5 transition-all',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary',
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center',
                      opt.container,
                      previewContainer.className,
                    )}
                    style={previewContainer.style}
                  >
                    <PreviewIcon
                      className={cn(opt.icon, previewIcon.className)}
                      style={previewIcon.style}
                    />
                  </div>
                  <span className="text-[10px] font-medium">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Estilo del icono</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {ICON_STYLE_OPTIONS.map((opt) => {
            const isActive = iconStyle === opt.value
            const previewContainer = resolveIconContainerStyle(
              color,
              shapeCfg.className,
              opt.value,
            )
            const previewIcon = resolveIconStyle(color, opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onIconStyleChange(opt.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                  isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:bg-secondary',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center',
                    previewContainer.className,
                  )}
                  style={previewContainer.style}
                >
                  <PreviewIcon
                    className={cn('h-4 w-4', previewIcon.className)}
                    style={previewIcon.style}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="menu-badge">Etiqueta en menú</Label>
        <p className="-mt-1 text-xs text-muted-foreground">
          Texto corto opcional junto al nombre (ej. Nuevo, Beta). Máx. 12 caracteres.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMenuBadgeChange('')}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
              !menuBadge
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-secondary text-muted-foreground',
            )}
          >
            Sin etiqueta
          </button>
          {MENU_BADGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onMenuBadgeChange(preset)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                menuBadge === preset
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-secondary text-muted-foreground hover:border-primary/30',
              )}
            >
              {preset}
            </button>
          ))}
        </div>
        <Input
          id="menu-badge"
          value={menuBadge}
          onChange={(e) => onMenuBadgeChange(e.target.value.slice(0, 12))}
          disabled={disabled}
          placeholder="Texto personalizado…"
          className="max-w-xs border-border bg-secondary text-sm"
        />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background/60 px-3 py-2.5">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center',
            sizeCfg.container,
            containerPreview.className,
          )}
          style={containerPreview.style}
        >
          <PreviewIcon
            className={cn(sizeCfg.icon, iconPreview.className)}
            style={iconPreview.style}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            Nombre del módulo
            {menuBadge ? (
              <span className="ml-2 inline-flex rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {menuBadge}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">Vista previa en el menú lateral</p>
        </div>
      </div>
    </div>
  )
}
