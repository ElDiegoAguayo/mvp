'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  listarModulosConTablas,
  habilitarCentro,
  deshabilitarCentro,
  type ModuleConTablas,
  type TablaOption,
} from '@/app/actions/centros-costo'
// NativeTableDef types live in lib/native-modules (not re-exported from server actions)
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  TableIcon,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Settings2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────────────────────────
// Config dialog — set label + columns for a table
// ─────────────────────────────────────────────────────────────────────────────

interface ConfigDialogProps {
  tabla: TablaOption
  onSave: (label: string, colCodigo: string, colNombre: string, colsExtra: string) => Promise<void>
  onClose: () => void
}

function ConfigDialog({ tabla, onSave, onClose }: ConfigDialogProps) {
  const [label, setLabel]         = useState(tabla.label ?? tabla.nombre)
  const [colCodigo, setColCodigo] = useState(tabla.col_codigo ?? tabla.columnas[0] ?? '')
  const [colNombre, setColNombre] = useState(tabla.col_nombre ?? tabla.columnas[1] ?? '')
  const [saving, setSaving]       = useState(false)

  // Parse existing cols_extra into a Set of checked columns
  const initExtra = () => {
    const existing = tabla.cols_extra ?? ''
    return new Set(existing.split(',').map((s) => s.trim()).filter(Boolean))
  }
  const [extraCols, setExtraCols] = useState<Set<string>>(initExtra)

  const columnas  = tabla.columnas
  const isNative  = tabla.tipo === 'native'

  // Columns available for "extra" = all columns except the chosen código/nombre
  const colsDisponibles = columnas.filter(
    (c) => c !== colCodigo && c !== colNombre,
  )

  const toggleExtra = (col: string, checked: boolean) => {
    setExtraCols((prev) => {
      const next = new Set(prev)
      checked ? next.add(col) : next.delete(col)
      return next
    })
  }

  // When the primary columns change, remove them from extraCols if present
  const handleColCodigo = (v: string) => {
    setColCodigo(v)
    setExtraCols((prev) => { const next = new Set(prev); next.delete(v); return next })
  }
  const handleColNombre = (v: string) => {
    setColNombre(v)
    setExtraCols((prev) => { const next = new Set(prev); next.delete(v); return next })
  }

  const handleSave = async () => {
    setSaving(true)
    const colsExtraStr = [...extraCols].join(',')
    await onSave(label, colCodigo, colNombre, colsExtraStr)
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Settings2 className="w-4 h-4 text-primary" />
            Configurar centro de costo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            <span>
              {isNative ? 'Módulo nativo:' : 'Tabla:'}{' '}
              <strong className="text-foreground">{tabla.nombre}</strong>
              {isNative && <span className="ml-1 text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded px-1">nativo</span>}.
              Define cómo se mostrará al cliente al asignar un gasto.
            </span>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Etiqueta para el cliente *</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ej: Contenedores, Pallets de venta..."
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
            <p className="text-[11px] text-muted-foreground">El nombre que verá el cliente al seleccionar el módulo.</p>
          </div>

          {/* Col código */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Columna identificador (código) *</label>
            <select
              value={colCodigo}
              onChange={(e) => handleColCodigo(e.target.value)}
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary"
            >
              {columnas.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">Columna única que identifica cada registro (nro. contenedor, código, etc.).</p>
          </div>

          {/* Col nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Columna descripción (opcional)</label>
            <select
              value={colNombre}
              onChange={(e) => handleColNombre(e.target.value)}
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="">— Sin descripción —</option>
              {columnas.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">Columna que se mostrará junto al código.</p>
          </div>

          {/* Columnas extra — checkbox list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Columnas visibles para el cliente
                {extraCols.size > 0 && (
                  <span className="ml-2 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5">
                    {extraCols.size} seleccionada{extraCols.size !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
              {extraCols.size > 0 && (
                <button
                  onClick={() => setExtraCols(new Set())}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Limpiar
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Marca las columnas adicionales que el cliente verá al seleccionar un registro de esta tabla.
              Las columnas de código y descripción siempre se muestran.
            </p>

            {colsDisponibles.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic px-1">
                No hay columnas adicionales disponibles (sólo existen las columnas de código y descripción).
              </p>
            ) : (
              <div className="rounded-lg border border-border bg-secondary/20 divide-y divide-border">
                {colsDisponibles.map((col) => (
                  <label
                    key={col}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={extraCols.has(col)}
                      onChange={(e) => toggleExtra(col, e.target.checked)}
                      className="rounded border-border accent-primary flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-foreground">{col}</span>
                    </div>
                    {extraCols.has(col) && (
                      <span className="ml-auto text-[10px] text-primary shrink-0">visible</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">Cancelar</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !label.trim() || !colCodigo}
            className="gap-1.5 text-xs h-8"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ToggleRight className="w-3.5 h-3.5" />}
            Habilitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TablaRow — one table inside a module section
// ─────────────────────────────────────────────────────────────────────────────

interface TablaRowProps {
  clienteId: string
  modulo: ModuleConTablas
  tabla: TablaOption
  onChanged: () => void
}

function TablaRow({ clienteId, tabla, onChanged }: TablaRowProps) {
  const [configOpen, setConfigOpen] = useState(false)
  const [toggling, setToggling]     = useState(false)

  const handleDisable = async () => {
    if (!tabla.config_id) return
    if (!confirm(`¿Deshabilitar "${tabla.label ?? tabla.nombre}" como centro de costo?`)) return
    setToggling(true)
    const res = await deshabilitarCentro(tabla.config_id)
    setToggling(false)
    if (res.ok) { toast.success(res.message); onChanged() }
    else toast.error(res.message)
  }

  const handleSaveConfig = async (label: string, colCodigo: string, colNombre: string, colsExtra: string) => {
    const opts = tabla.tipo === 'native'
      ? { tipo: 'native' as const, tablaNombreReal: tabla.tabla_nombre_real!, label, colCodigo, colNombre, colsExtra }
      : { tipo: 'dynamic' as const, tablaId: tabla.id, label, colCodigo, colNombre, colsExtra }
    const res = await habilitarCentro(clienteId, opts)
    if (res.ok) { toast.success(res.message); setConfigOpen(false); onChanged() }
    else toast.error(res.message)
  }

  return (
    <>
      <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors ${
        tabla.habilitado
          ? 'border-primary/30 bg-primary/5'
          : 'border-border bg-secondary/20'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <TableIcon className={`w-4 h-4 shrink-0 ${tabla.habilitado ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">
                {tabla.habilitado ? (tabla.label ?? tabla.nombre) : tabla.nombre}
              </p>
              {tabla.tipo === 'native' && (
                <span className="text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded px-1.5 shrink-0">nativo</span>
              )}
            </div>
            {tabla.habilitado && (
              <div className="mt-0.5 space-y-0.5">
                <p className="text-[11px] text-muted-foreground">
                  Código: <code className="font-mono bg-secondary px-1 rounded">{tabla.col_codigo}</code>
                  {tabla.col_nombre && (
                    <> · Nombre: <code className="font-mono bg-secondary px-1 rounded">{tabla.col_nombre}</code></>
                  )}
                </p>
                {tabla.cols_extra ? (
                  <p className="text-[11px] text-muted-foreground">
                    Columnas extra:{' '}
                    {tabla.cols_extra.split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
                      <code key={c} className="font-mono bg-secondary px-1 rounded mr-1">{c}</code>
                    ))}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/50 italic">Sin columnas extra configuradas</p>
                )}
              </div>
            )}
            {!tabla.habilitado && tabla.columnas.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {tabla.columnas.length} columnas disponibles
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tabla.habilitado ? (
            <>
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0">
                Habilitado
              </Badge>
              <button
                onClick={() => setConfigOpen(true)}
                className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                title="Editar configuración"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDisable}
                disabled={toggling}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Deshabilitar"
              >
                {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            tabla.columnas.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfigOpen(true)}
                disabled={toggling}
                className="gap-1.5 text-xs h-7"
              >
                {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ToggleRight className="w-3 h-3" />}
                Habilitar
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground italic">Sin columnas</span>
            )
          )}
        </div>
      </div>

      {configOpen && (
        <ConfigDialog
          tabla={tabla}
          onSave={handleSaveConfig}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ModuleSection — collapsible section per module
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleSectionProps {
  clienteId: string
  modulo: ModuleConTablas
  onChanged: () => void
}

function ModuleSection({ clienteId, modulo, onChanged }: ModuleSectionProps) {
  const [open, setOpen] = useState(true)
  const enabled = modulo.tablas.filter((t) => t.habilitado).length

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">{modulo.modulo_nombre}</span>
          <span className="text-xs text-muted-foreground">/{modulo.modulo_slug}</span>
        </div>
        <div className="flex items-center gap-2">
          {enabled > 0 && (
            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1.5">
              {enabled} habilitado{enabled !== 1 ? 's' : ''}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{modulo.tablas.length} tabla{modulo.tablas.length !== 1 ? 's' : ''}</span>
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {modulo.tablas.map((tabla) => (
            <TablaRow
              key={tabla.id}
              clienteId={clienteId}
              modulo={modulo}
              tabla={tabla}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  clienteId: string
}

export function EntidadesCostoManager({ clienteId }: Props) {
  const [modulos, setModulos] = useState<ModuleConTablas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listarModulosConTablas(clienteId)
    setLoading(false)
    if (res.ok) { setModulos(res.data); setError(null) }
    else setError(res.message ?? 'Error al cargar.')
  }, [clienteId])

  useEffect(() => { load() }, [load])

  const totalHabilitados = modulos.reduce((s, m) => s + m.tablas.filter((t) => t.habilitado).length, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Centros de Costo</h3>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
          Habilita tablas de los módulos del cliente como centros de costo. Al asignar un gasto,
          el cliente podrá ver los registros reales de esas tablas y elegir a cuál asignar el costo.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : modulos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center border border-dashed border-border rounded-xl">
          <TableIcon className="w-8 h-8 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium text-foreground">Sin módulos con tablas</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Este cliente no tiene módulos activos con tablas de datos. Primero crea tablas
              en los módulos del cliente desde el panel de administración.
            </p>
          </div>
        </div>
      ) : (
        <>
          {totalHabilitados > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-400">
              <ToggleRight className="w-4 h-4 shrink-0" />
              {totalHabilitados} tabla{totalHabilitados !== 1 ? 's' : ''} habilitada{totalHabilitados !== 1 ? 's' : ''} como centro{totalHabilitados !== 1 ? 's' : ''} de costo.
              El cliente puede seleccionar registros de {totalHabilitados !== 1 ? 'estas tablas' : 'esta tabla'} al asignar gastos.
            </div>
          )}

          <div className="space-y-3">
            {modulos.map((m) => (
              <ModuleSection
                key={m.modulo_id}
                clienteId={clienteId}
                modulo={m}
                onChanged={load}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
