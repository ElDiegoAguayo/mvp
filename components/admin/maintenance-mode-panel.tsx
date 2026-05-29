'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Construction,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Save,
  BookmarkPlus,
  Trash2,
} from 'lucide-react'
import {
  createMaintenancePresetAction,
  deleteMaintenancePresetAction,
  getMaintenanceModeAction,
  updateMaintenanceModeAction,
} from '@/app/admin/maintenance-actions'
import {
  allMaintenancePresets,
  type PlatformMaintenanceState,
  type SavedMaintenancePreset,
} from '@/lib/platform-maintenance'

function formatUpdatedAt(iso: string | null) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return null
  }
}

function findPresetIdForMessage(
  message: string,
  customPresets: SavedMaintenancePreset[],
): string {
  const all = allMaintenancePresets(customPresets)
  const match = all.find((p) => p.message === message)
  return match?.id ?? 'custom'
}

export function MaintenanceModePanel() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [message, setMessage] = useState('')
  const [presetId, setPresetId] = useState<string>('custom')
  const [presetLabel, setPresetLabel] = useState('')
  const [customPresets, setCustomPresets] = useState<SavedMaintenancePreset[]>([])
  const [meta, setMeta] = useState<PlatformMaintenanceState | null>(null)
  const [isPending, startTransition] = useTransition()

  const presetOptions = useMemo(
    () => allMaintenancePresets(customPresets),
    [customPresets],
  )

  const applyState = useCallback((state: PlatformMaintenanceState) => {
    setEnabled(state.enabled)
    setMessage(state.message)
    setCustomPresets(state.customPresets)
    setMeta(state)
    setPresetId(findPresetIdForMessage(state.message, state.customPresets))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const state = await getMaintenanceModeAction()
    if (state) applyState(state)
    setLoading(false)
  }, [applyState])

  useEffect(() => {
    void load()
  }, [load])

  function handlePresetChange(id: string) {
    setPresetId(id)
    if (id === 'custom') return
    const preset = presetOptions.find((p) => p.id === id)
    if (preset) setMessage(preset.message)
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateMaintenanceModeAction({ enabled, message })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message)
      if (res.state) applyState(res.state)
    })
  }

  function handleSavePreset() {
    startTransition(async () => {
      const res = await createMaintenancePresetAction({
        label: presetLabel,
        message,
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message)
      setPresetLabel('')
      if (res.state) {
        applyState(res.state)
        const saved = res.state.customPresets.at(-1)
        if (saved) setPresetId(`saved-${saved.id}`)
      }
    })
  }

  function handleDeletePreset(id: string) {
    startTransition(async () => {
      const res = await deleteMaintenancePresetAction(id)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message)
      if (res.state) {
        applyState(res.state)
        if (presetId === `saved-${id}`) setPresetId('custom')
      }
    })
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        Cargando modo mantenimiento…
      </div>
    )
  }

  const builtInPresets = presetOptions.filter((p) => !p.id.startsWith('saved-'))
  const savedPresets = presetOptions.filter((p) => p.id.startsWith('saved-'))

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 shadow-sm space-y-5 transition-colors',
        enabled
          ? 'bg-amber-500/5 border-amber-500/40'
          : 'bg-card border-border',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
              enabled
                ? 'bg-amber-500/15 border-amber-500/30'
                : 'bg-[#4A6CF7]/10 border-[#4A6CF7]/20',
            )}
          >
            <Construction
              className={cn('w-5 h-5', enabled ? 'text-amber-600 dark:text-amber-400' : 'text-[#4A6CF7]')}
            />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Modo mantenimiento</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Bloquea el inicio de sesión de <strong className="text-foreground font-medium">clientes y subusuarios</strong>.
              Los administradores siguen pudiendo entrar.
            </p>
            {meta?.updatedAt && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Último cambio: {formatUpdatedAt(meta.updatedAt)}
                {meta.updatedByEmail ? ` · ${meta.updatedByEmail}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 sm:pt-1">
          {enabled && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              Activo
            </span>
          )}
          <div className="flex items-center gap-2">
            <Label htmlFor="maintenance-toggle" className="text-xs text-muted-foreground sr-only">
              Activar mantenimiento
            </Label>
            <Switch
              id="maintenance-toggle"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={isPending}
            />
            <span className="text-sm font-medium text-foreground w-16">
              {enabled ? 'Activado' : 'Apagado'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Mensaje predefinido</Label>
          <Select value={presetId} onValueChange={handlePresetChange} disabled={isPending}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Elegir plantilla" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Plantillas del sistema</SelectLabel>
                {builtInPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              {savedPresets.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Tus plantillas</SelectLabel>
                  {savedPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              <SelectGroup>
                <SelectItem value="custom">Personalizado (sin plantilla)</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg bg-secondary/60 border border-border px-3 py-2.5 w-full">
            <ShieldCheck className="w-4 h-4 text-[#4A6CF7] shrink-0" />
            <span>Los admins no ven este bloqueo al iniciar sesión.</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maintenance-message" className="text-xs text-muted-foreground">
          Mensaje para clientes
        </Label>
        <Textarea
          id="maintenance-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            setPresetId('custom')
          }}
          rows={4}
          disabled={isPending}
          className="bg-secondary border-border resize-none text-sm"
          placeholder="Mensaje que verán los clientes al intentar iniciar sesión…"
        />
      </div>

      <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookmarkPlus className="w-4 h-4 text-[#4A6CF7]" />
          <p className="text-sm font-medium text-foreground">Guardar como plantilla</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Usa el mensaje de arriba y asígnale un nombre para reutilizarlo después.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={presetLabel}
            onChange={(e) => setPresetLabel(e.target.value)}
            disabled={isPending}
            placeholder="Nombre de la plantilla (ej. Deploy viernes)"
            className="bg-secondary border-border flex-1"
            maxLength={80}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !presetLabel.trim() || !message.trim()}
            onClick={handleSavePreset}
            className="shrink-0 border-border"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <BookmarkPlus className="w-4 h-4 mr-2" />
            )}
            Guardar plantilla
          </Button>
        </div>

        {customPresets.length > 0 && (
          <div className="pt-2 space-y-2 border-t border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tus plantillas guardadas
            </p>
            <ul className="space-y-1.5">
              {customPresets.map((preset) => (
                <li
                  key={preset.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{preset.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{preset.message}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => handleDeletePreset(preset.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Eliminar plantilla ${preset.label}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        {enabled ? (
          <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Los clientes con sesión abierta serán desconectados al navegar.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Activa el interruptor y guarda para bloquear el acceso de clientes.
          </p>
        )}
        <Button
          onClick={handleSave}
          disabled={isPending || !message.trim()}
          className="bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white shrink-0 sm:ml-auto"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
