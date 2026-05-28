'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  listarConfigsCliente,
  buscarEnTabla,
  type CentroCostoConfig,
  type FilaTabla,
} from '@/app/actions/centros-costo'
import {
  guardarAsignaciones,
  obtenerAsignacionesPorFactura,
} from '@/app/actions/asignaciones'
import {
  TableIcon,
  Search,
  X,
  Loader2,
  Save,
  Split,
  CheckCircle2,
  Info,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30

function formatCLP(v: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(v)
}

/** Convert snake_case / camelCase column names to readable labels */
function colLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Truncate UUIDs and very long strings for display */
function truncateVal(val: unknown): string {
  const s = String(val ?? '—')
  // UUID pattern — show only first 8 chars
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return s.slice(0, 8) + '…'
  }
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}

// ─────────────────────────────────────────────────────────────────────────────
// RowPickerDialog — table of real data from a dynamic_table
// ─────────────────────────────────────────────────────────────────────────────

interface RowPickerProps {
  config: CentroCostoConfig
  clienteId: string
  alreadySelected: FilaTabla[]
  onConfirm: (rows: FilaTabla[], config: CentroCostoConfig) => void
  onClose: () => void
}

function RowPickerDialog({ config, clienteId, alreadySelected, onConfirm, onClose }: RowPickerProps) {
  const [query, setQuery]     = useState('')
  const [page, setPage]       = useState(0)
  const [filas, setFilas]     = useState<FilaTabla[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [staged, setStaged]   = useState<FilaTabla[]>(alreadySelected)
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setStaged(alreadySelected) }, [alreadySelected])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const res = await buscarEnTabla(config, clienteId, query, page, PAGE_SIZE)
      setLoading(false)
      if (res.ok) { setFilas(res.filas); setTotal(res.total) }
    }, query ? 300 : 0)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [config.tabla_id, config.col_codigo, config.col_nombre, query, page])

  useEffect(() => { setPage(0) }, [query])

  const stagedIds  = new Set(staged.map((r) => r.row_id))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const toggle = (row: FilaTabla) => {
    setStaged((prev) =>
      prev.some((r) => r.row_id === row.row_id)
        ? prev.filter((r) => r.row_id !== row.row_id)
        : [...prev, row],
    )
  }

  const toggleAll = () => {
    const allSelected = filas.every((r) => stagedIds.has(r.row_id))
    if (allSelected) {
      const ids = new Set(filas.map((r) => r.row_id))
      setStaged((prev) => prev.filter((r) => !ids.has(r.row_id)))
    } else {
      const newOnes = filas.filter((r) => !stagedIds.has(r.row_id))
      setStaged((prev) => [...prev, ...newOnes])
    }
  }

  const allCurrentSelected = filas.length > 0 && filas.every((r) => stagedIds.has(r.row_id))

  // Use the admin-configured cols_extra list (never auto-infer from data keys)
  const extraCols = config.cols_extra
    ? config.cols_extra.split(',').map((c) => c.trim()).filter(Boolean)
    : []

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <TableIcon className="w-4 h-4 text-primary" />
            {config.label}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Selecciona uno o más registros para asignarles este gasto.
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 focus-within:border-primary/60">
            {loading
              ? <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
              : <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            }
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar en ${config.label.toLowerCase()}…`}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 min-w-0"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selection summary */}
        {staged.length > 0 && (
          <div className="px-5 py-2 bg-primary/5 border-b border-primary/20 flex items-center justify-between gap-2 shrink-0">
            <span className="text-xs text-primary font-medium">
              {staged.length} {staged.length === 1 ? 'registro seleccionado' : 'registros seleccionados'}
            </span>
            <button onClick={() => setStaged([])} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              Limpiar
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-auto flex-1" style={{ minHeight: '280px', maxHeight: '400px' }}>
          {loading && filas.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <TableIcon className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {query ? `Sin resultados para "${query}"` : 'Esta tabla no tiene registros.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/60 backdrop-blur border-b border-border z-10">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={toggleAll}
                      className="rounded border-border accent-primary"
                    />
                  </th>
                  <th className="text-left font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                    {colLabel(config.col_codigo)}
                  </th>
                  {config.col_nombre && (
                    <th className="text-left font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                      {colLabel(config.col_nombre)}
                    </th>
                  )}
                  {extraCols.map((c) => (
                    <th key={c} className="text-left font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                      {colLabel(c)}
                    </th>
                  ))}
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {filas.map((row) => {
                  const checked = stagedIds.has(row.row_id)
                  return (
                    <tr
                      key={row.row_id}
                      onClick={() => toggle(row)}
                      className={`border-b border-border/40 cursor-pointer transition-colors ${
                        checked ? 'bg-primary/8 hover:bg-primary/12' : 'hover:bg-secondary/40'
                      }`}
                    >
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(row)}
                          className="rounded border-border accent-primary"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-foreground whitespace-nowrap max-w-[160px] truncate" title={row.codigo}>
                        {truncateVal(row.codigo) || '—'}
                      </td>
                      {config.col_nombre && (
                        <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate" title={row.nombre}>
                          {row.nombre ? truncateVal(row.nombre) : <span className="italic opacity-40">—</span>}
                        </td>
                      )}
                      {extraCols.map((c) => (
                        <td key={c} className="px-3 py-2.5 text-muted-foreground max-w-[140px] truncate" title={String(row.data[c] ?? '')}>
                          {truncateVal(row.data[c])}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right">
                        {checked && (
                          <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0 h-4">
                            Sel.
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="px-5 py-2.5 border-t border-border flex items-center justify-between gap-3 text-xs text-muted-foreground shrink-0">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded hover:bg-secondary disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 tabular-nums">{page + 1}/{totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-secondary disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <DialogFooter className="px-5 py-3 border-t border-border bg-card shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">Cancelar</Button>
          <Button
            size="sm"
            onClick={() => onConfirm(staged, config)}
            disabled={staged.length === 0}
            className="gap-1.5 text-xs h-8"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar asignación {staged.length > 0 ? `(${staged.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AsignacionPanel
// ─────────────────────────────────────────────────────────────────────────────

interface AsignacionPanelProps {
  facturaId: string
  clienteId: string
  montoBruto: number
  numeroDocumento: string
  onSaved?: (label: string) => void
}

export function AsignacionPanel({
  facturaId,
  clienteId,
  montoBruto,
  numeroDocumento,
  onSaved,
}: AsignacionPanelProps) {
  const [configs, setConfigs]             = useState<CentroCostoConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [activeConfig, setActiveConfig]   = useState<CentroCostoConfig | null>(null)
  const [selected, setSelected]           = useState<FilaTabla[]>([])
  const [pickerOpen, setPickerOpen]       = useState(false)
  const [saving, setSaving]               = useState(false)
  const [hasExisting, setHasExisting]     = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [existingLabel, setExistingLabel] = useState<string | null>(null)
  const [editing, setEditing]             = useState(false)

  // Load centros de costo configs for this client
  useEffect(() => {
    listarConfigsCliente(clienteId)
      .then((res) => {
        if (res.ok) {
          setConfigs(res.data)
          if (res.data.length > 0) setActiveConfig(res.data[0])
        }
      })
      .finally(() => setLoadingConfigs(false))
  }, [clienteId])

  // Load existing assignments and build a summary label
  useEffect(() => {
    obtenerAsignacionesPorFactura(facturaId, clienteId)
      .then((res) => {
        if (res.ok && res.data.length > 0) {
          setHasExisting(true)
          // Build a readable summary: "Contenedores (3 registros)"
          const byLabel = res.data.reduce<Record<string, number>>((acc, a) => {
            const lbl = String((a.metadata as Record<string,unknown>)?.label ?? 'Centro')
            acc[lbl] = (acc[lbl] ?? 0) + 1
            return acc
          }, {})
          const summary = Object.entries(byLabel)
            .map(([lbl, cnt]) => `${lbl} (${cnt})`)
            .join(', ')
          setExistingLabel(summary)
        }
      })
      .finally(() => setLoadingExisting(false))
  }, [facturaId, clienteId])

  const handleConfigChange = (cfg: CentroCostoConfig) => {
    setActiveConfig(cfg)
    setSelected([])
  }

  const handlePickerConfirm = (rows: FilaTabla[], cfg: CentroCostoConfig) => {
    setSelected(rows)
    handleSaveRows(rows, cfg)
  }

  const removeRow = useCallback((rowId: string) => {
    setSelected((prev) => prev.filter((r) => r.row_id !== rowId))
  }, [])

  const n        = selected.length
  const perParte = n > 0 ? Math.round(montoBruto / n) : 0
  const pct      = n > 0 ? Math.round((100 / n) * 100) / 100 : 0

  /** Called directly from the picker "Confirmar" button — saves immediately */
  const handleSaveRows = async (rows: FilaTabla[], cfg: CentroCostoConfig) => {
    if (rows.length === 0) return
    setSaving(true)
    try {
      const count       = rows.length
      const perParteMon = Math.round(montoBruto / count)
      const pctEach     = Math.round((100 / count) * 100) / 100
      const asignaciones = rows.map((row) => ({
        entidad_id: row.codigo || row.row_id,
        entidad_tipo: 'dinamico' as const,
        monto_asignado: perParteMon,
        porcentaje: pctEach,
        metadata: {
          config_id: cfg.id,
          label: cfg.label,
          row_id: row.row_id,
          nombre: row.nombre,
          cols_extra: cfg.cols_extra ?? '',
          data: row.data ?? {},
        },
      }))
      const res = await guardarAsignaciones(clienteId, facturaId, montoBruto, asignaciones as Parameters<typeof guardarAsignaciones>[3], true)
      if (res.ok) {
        toast.success(res.message)
        setSelected(rows)
        setHasExisting(true)
        setEditing(false)
        const lbl = `${cfg.label} (${count})`
        setExistingLabel(lbl)
        onSaved?.(lbl)
      } else {
        toast.error(`Error al guardar: ${res.message}`)
      }
    } catch (err) {
      toast.error(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!activeConfig) { toast.error('Selecciona un módulo primero.'); return }
    if (n === 0) { toast.error('Selecciona al menos un registro.'); return }
    await handleSaveRows(selected, activeConfig)
  }

  // If already assigned and not in edit mode, show summary + edit button
  const showReadOnly = hasExisting && !loadingExisting && !editing && selected.length === 0

  return (
    <div className="space-y-3 p-4 rounded-lg border border-dashed border-border bg-secondary/20">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Split className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
            Asignar a Centro de Costo
          </span>
          {loadingExisting && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          {hasExisting && !loadingExisting && (
            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 gap-1 px-1.5 py-0">
              <CheckCircle2 className="w-2.5 h-2.5" /> Asignada
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">
          Doc. #{numeroDocumento || '—'} · {formatCLP(montoBruto)}
        </span>
      </div>

      {/* Already-assigned summary — shown when not editing */}
      {showReadOnly && existingLabel && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
              {existingLabel}
            </span>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-muted-foreground hover:text-primary shrink-0 underline underline-offset-2"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Assignment form — shown when no assignment or in edit mode */}
      {!showReadOnly && (
      <div className="space-y-3">
      {/* Step 1: choose module */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">1. Selecciona el módulo</p>
        {loadingConfigs ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando módulos…
          </div>
        ) : configs.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            El administrador aún no ha habilitado módulos de costos para tu cuenta.
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {configs.map((cfg) => (
              <button
                key={cfg.id}
                onClick={() => handleConfigChange(cfg)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  activeConfig?.id === cfg.id
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5 shrink-0" />
                {cfg.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: pick records */}
      {activeConfig && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">2. Elige los registros</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-primary" />
              {n === 0
                ? `Ver registros de ${activeConfig.label}…`
                : `${n} registro${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''} de ${activeConfig.label}`
              }
            </span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {selected.map((row) => (
            <span
              key={row.row_id}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
            >
              <span className="font-mono">{row.codigo}</span>
              {row.nombre && <span className="opacity-70 truncate max-w-[100px]">{row.nombre}</span>}
              <button onClick={() => removeRow(row.row_id)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Division preview */}
      {n > 0 && activeConfig && (
        <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-foreground leading-relaxed">
            El monto de <strong className="tabular-nums">{formatCLP(montoBruto)}</strong> se dividirá
            en <strong>{n}</strong> parte{n !== 1 ? 's' : ''} de{' '}
            <strong className="tabular-nums">{formatCLP(perParte)}</strong> cada una
            ({pct}% por registro de {activeConfig.label}).
          </p>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center justify-between gap-2">
        {editing && (
          <button
            onClick={() => { setEditing(false); setSelected([]) }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Cancelar
          </button>
        )}
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || n === 0}
            className="gap-1.5 text-xs h-8"
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</>
              : <><Save className="w-3.5 h-3.5" /> Guardar {n > 0 ? `${n} asignación${n !== 1 ? 'es' : ''}` : 'asignación'}</>
            }
          </Button>
        </div>
      </div>
      </div>
      )}

      {/* Picker dialog */}
      {pickerOpen && activeConfig && (
        <RowPickerDialog
          config={activeConfig}
          clienteId={clienteId}
          alreadySelected={selected}
          onConfirm={(rows, cfg) => { handlePickerConfirm(rows, cfg); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
