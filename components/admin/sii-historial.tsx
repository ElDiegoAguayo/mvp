'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  obtenerHistorialCargas,
  obtenerRegistrosPorLote,
  obtenerTodosRegistrosCliente,
  eliminarLoteSII,
  eliminarTodosRegistrosSII,
  type HistorialCarga,
  type RegistroDetalle,
} from '@/app/actions/costos-gastos'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  History,
  Loader2,
  FileSpreadsheet,
  Eye,
  Trash2,
  AlertCircle,
  InboxIcon,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'

const UNDO_SECONDS = 10

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCLP(v: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(v)
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail modal inner table
// ─────────────────────────────────────────────────────────────────────────────

type DetalleCol = {
  key: keyof RegistroDetalle
  label: string
  align?: 'right' | 'left'
  mono?: boolean
  format?: (v: unknown) => string
}

const fmtDate = (v: unknown) =>
  v ? String(v) : '—'

const fmtDateTime = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

const fmtNum = (v: unknown) => formatCLP(Number(v ?? 0))
const fmtPct = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : `${Number(v)}%`

// Column order mirrors the SII Libro de Compras portal export
const DETALLE_COLUMNS: DetalleCol[] = [
  { key: 'rut_contraparte',      label: 'RUT',                  align: 'left',  mono: true },
  { key: 'razon_social',         label: 'Contraparte',          align: 'left' },
  { key: 'fecha_emision',        label: 'Fecha Emisión',        align: 'left',  mono: true, format: fmtDate },
  { key: 'fecha_devengo',        label: 'Fecha Devengo',        align: 'left',  mono: true, format: fmtDate },
  { key: 'fecha_vencimiento',    label: 'Fecha Vencimiento',    align: 'left',  mono: true, format: fmtDate },
  { key: 'numero_documento',     label: 'N° Documento',         align: 'left',  mono: true },
  { key: 'tipo_obligacion',      label: 'Tipo Obligación',      align: 'left' },
  { key: 'tipo_documento',       label: 'Tipo Documento',       align: 'left' },
  { key: 'monto_neto',           label: 'Monto Neto',           align: 'right', format: fmtNum },
  { key: 'monto_exento',         label: 'Monto Exento',         align: 'right', format: fmtNum },
  { key: 'monto_iva',            label: 'IVA',                  align: 'right', format: fmtNum },
  { key: 'iva_no_recuperable',   label: 'IVA No Recuperable',   align: 'right', format: fmtNum },
  { key: 'otros_impuestos',      label: 'Otros Impuestos',      align: 'right', format: fmtNum },
  { key: 'retencion_honorarios', label: 'Ret. Honorarios',      align: 'right', format: fmtNum },
  { key: 'monto_bruto',          label: 'Monto Bruto',          align: 'right', format: fmtNum },
  { key: 'monto_base',           label: 'Monto Base',           align: 'right', format: fmtNum },
  { key: 'monto_calculado',      label: 'Monto Calculado',      align: 'right', format: fmtNum },
  { key: 'porcentaje',           label: 'Porcentaje',           align: 'right', format: fmtPct },
  { key: 'anula_o_modifica',     label: 'Anula o Modifica',     align: 'left',  mono: true },
  { key: 'estado_clasificacion', label: 'Estado',               align: 'left' },
  { key: 'created_at',           label: 'Fecha Carga',          align: 'left',  mono: true, format: fmtDateTime },
]

// Indices used for footer colspan calculation
const IDX_MONTO_NETO  = DETALLE_COLUMNS.findIndex((c) => c.key === 'monto_neto')   // 6
const IDX_MONTO_BRUTO = DETALLE_COLUMNS.findIndex((c) => c.key === 'monto_bruto')  // 8
// Cells before the monetary block: 1 (#) + IDX_MONTO_NETO columns
const FOOTER_LABEL_COLSPAN  = 1 + IDX_MONTO_NETO
// Cells after the monetary block
const FOOTER_TRAIL_COLSPAN  = DETALLE_COLUMNS.length - (IDX_MONTO_BRUTO + 1)

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === 'pendiente') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
        Pendiente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
      {estado}
    </span>
  )
}

interface DetalleTableProps {
  clienteId: string
  carga: HistorialCarga
}

function DetalleTable({ clienteId, carga }: DetalleTableProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<RegistroDetalle[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    // When lote_id is available, fetch only that batch's rows.
    // For legacy imports (before migration 013) fall back to all client records.
    const fetchFn = carga.lote_id
      ? obtenerRegistrosPorLote(clienteId, carga.lote_id)
      : obtenerTodosRegistrosCliente(clienteId)

    fetchFn
      .then((res) => {
        if (res.ok) {
          setRows(res.data)
          setTotal(res.total)
        } else {
          setError(res.message ?? 'Error al cargar los datos.')
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error inesperado.'))
      .finally(() => setLoading(false))
  }, [clienteId, carga.lote_id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <InboxIcon className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No se encontraron registros para este lote.</p>
      </div>
    )
  }

  // Compute quick totals for the footer
  const totalNeto  = rows.reduce((s, r) => s + Number(r.monto_neto), 0)
  const totalIva   = rows.reduce((s, r) => s + Number(r.monto_iva), 0)
  const totalBruto = rows.reduce((s, r) => s + Number(r.monto_bruto), 0)

  return (
    // flex-1 + min-h-0: lets this component stretch to fill the dialog body
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Row count */}
      <div className="shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Mostrando <strong className="text-foreground">{rows.length.toLocaleString('es-CL')}</strong> de{' '}
          <strong className="text-foreground">{total.toLocaleString('es-CL')}</strong> registros
        </span>
        {total > 10_000 && (
          <Badge variant="secondary" className="text-[10px]">
            Limitado a 10.000 filas
          </Badge>
        )}
      </div>

      {/* Scrollable Excel-style table — fills remaining height, scrolls both axes */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
        <table className="text-xs border-collapse" style={{ minWidth: '2400px', width: 'max-content' }}>
          <thead className="sticky top-0 z-10 bg-secondary">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted-foreground w-10 shrink-0">
                #
              </th>
              {DETALLE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`border-b border-border px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className="border-b border-border/50 hover:bg-primary/5 transition-colors"
              >
                <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                  {idx + 1}
                </td>
                {DETALLE_COLUMNS.map((col) => {
                  const raw = row[col.key]
                  const display = col.format
                    ? col.format(raw)
                    : (raw === null || raw === undefined || raw === '') ? '—' : String(raw)

                  if (col.key === 'estado_clasificacion') {
                    return (
                      <td key={col.key} className="px-3 py-1.5">
                        <EstadoBadge estado={String(raw ?? '')} />
                      </td>
                    )
                  }

                  return (
                    <td
                      key={col.key}
                      className={[
                        'px-3 py-1.5 whitespace-nowrap text-foreground',
                        col.align === 'right' ? 'text-right tabular-nums' : '',
                        col.mono ? 'font-mono' : '',
                        // Highlight amounts
                        col.key === 'monto_bruto' ? 'font-semibold text-foreground' : '',
                        col.key === 'monto_neto' || col.key === 'monto_iva' ? 'text-muted-foreground' : '',
                      ].join(' ')}
                      title={display}
                    >
                      {col.key === 'razon_social' || col.key === 'detalle_gasto'
                        ? <span className="block max-w-[200px] truncate">{display}</span>
                        : display}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {/* Totals footer */}
          <tfoot className="sticky bottom-0 bg-secondary border-t-2 border-border">
            <tr>
              <td
                colSpan={FOOTER_LABEL_COLSPAN}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right"
              >
                Totales ({rows.length.toLocaleString('es-CL')} filas):
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-right tabular-nums text-muted-foreground border-l border-border/60">
                {formatCLP(totalNeto)}
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-right tabular-nums text-muted-foreground border-l border-border/60">
                {formatCLP(totalIva)}
              </td>
              <td className="px-3 py-2 text-xs font-bold text-right tabular-nums text-foreground border-l border-border/60">
                {formatCLP(totalBruto)}
              </td>
              {FOOTER_TRAIL_COLSPAN > 0 && <td colSpan={FOOTER_TRAIL_COLSPAN} />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component: SiiHistorial
// ─────────────────────────────────────────────────────────────────────────────

interface SiiHistorialProps {
  clienteId: string
  /** Increment to trigger a refetch (e.g. after a new upload) */
  refreshKey?: number
}

export function SiiHistorial({ clienteId, refreshKey = 0 }: SiiHistorialProps) {
  const [loading, setLoading]             = useState(true)
  const [cargas, setCargas]               = useState<HistorialCarga[]>([])
  const [error, setError]                 = useState<string | null>(null)
  const [modalCarga, setModalCarga]       = useState<HistorialCarga | null>(null)
  // Which row is pending confirmation (single lote or 'all')
  const [confirmTarget, setConfirmTarget] = useState<HistorialCarga | 'all' | null>(null)
  // Timer ref for deferred deletion — cleared on undo
  const deleteTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Snapshot of cargas before optimistic removal (for undo)
  const snapshotRef                       = useRef<HistorialCarga[]>([])

  const fetchHistorial = useCallback(() => {
    if (!clienteId) return
    setLoading(true)
    setError(null)
    obtenerHistorialCargas(clienteId)
      .then((res) => {
        if (res.ok) setCargas(res.data)
        else setError(res.message ?? 'Error al cargar el historial.')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error inesperado.'))
      .finally(() => setLoading(false))
  }, [clienteId])

  // Cancel any pending deletion timer on unmount
  useEffect(() => () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current) }, [])

  // ── Deferred single-lote delete ─────────────────────────────────────────────
  const handleDeleteLote = useCallback((carga: HistorialCarga) => {
    if (!carga.lote_id) return
    setConfirmTarget(null)

    // Optimistic removal
    snapshotRef.current = cargas
    setCargas((prev) => prev.filter((c) => c.id !== carga.id))

    const toastId = `del-${carga.id}`
    let undone = false

    toast(`Importación "${carga.archivo}" eliminada`, {
      id: toastId,
      description: `${carga.insertados.toLocaleString('es-CL')} registros. Tienes ${UNDO_SECONDS}s para deshacer.`,
      duration: UNDO_SECONDS * 1000,
      action: {
        label: '↩ Deshacer',
        onClick: () => {
          undone = true
          if (deleteTimerRef.current) { clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null }
          setCargas(snapshotRef.current)
          toast.success('Eliminación cancelada.', { id: toastId })
        },
      },
    })

    deleteTimerRef.current = setTimeout(async () => {
      if (undone) return
      try {
        const res = await eliminarLoteSII(clienteId, carga.lote_id!, carga.id)
        if (res.ok) {
          toast.success(`${res.eliminados.toLocaleString('es-CL')} registros eliminados permanentemente.`)
          fetchHistorial()
        } else {
          // Rollback on error
          setCargas(snapshotRef.current)
          toast.error(res.message)
        }
      } catch (e) {
        setCargas(snapshotRef.current)
        toast.error(e instanceof Error ? e.message : 'Error al eliminar.')
      }
    }, UNDO_SECONDS * 1000)
  }, [cargas, clienteId, fetchHistorial])

  // ── Deferred delete-all ─────────────────────────────────────────────────────
  const handleDeleteAll = useCallback(() => {
    setConfirmTarget(null)

    // Optimistic removal — clear entire list
    snapshotRef.current = cargas
    setCargas([])

    const toastId = 'del-all'
    let undone = false
    const totalRegistros = snapshotRef.current.reduce((s, c) => s + c.insertados, 0)

    toast('Todas las importaciones eliminadas', {
      id: toastId,
      description: `${snapshotRef.current.length} cargas · ${totalRegistros.toLocaleString('es-CL')} registros. Tienes ${UNDO_SECONDS}s para deshacer.`,
      duration: UNDO_SECONDS * 1000,
      action: {
        label: '↩ Deshacer',
        onClick: () => {
          undone = true
          if (deleteTimerRef.current) { clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null }
          setCargas(snapshotRef.current)
          toast.success('Eliminación cancelada.', { id: toastId })
        },
      },
    })

    deleteTimerRef.current = setTimeout(async () => {
      if (undone) return
      try {
        const res = await eliminarTodosRegistrosSII(clienteId)
        if (res.ok) {
          toast.success(`${res.eliminados.toLocaleString('es-CL')} registros eliminados permanentemente.`)
          fetchHistorial()
        } else {
          setCargas(snapshotRef.current)
          toast.error(res.message)
        }
      } catch (e) {
        setCargas(snapshotRef.current)
        toast.error(e instanceof Error ? e.message : 'Error al eliminar.')
      }
    }, UNDO_SECONDS * 1000)
  }, [cargas, clienteId, fetchHistorial])

  // Refetch on mount and whenever refreshKey changes
  useEffect(() => { fetchHistorial() }, [fetchHistorial, refreshKey])

  return (
    <>
      {/* Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Historial de Cargas</h3>
          {!loading && cargas.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {cargas.length}
            </Badge>
          )}
          {!loading && cargas.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-7 px-3 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60"
              onClick={() => setConfirmTarget('all')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar todo
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando historial…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        ) : cargas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
            <InboxIcon className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay importaciones registradas para este cliente.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Fecha de carga
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Archivo
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">
                    Registros
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargas.map((carga, idx) => (
                  <tr
                    key={carga.id}
                    className={[
                      'border-b border-border/50 transition-colors hover:bg-primary/5',
                      idx % 2 === 0 ? '' : 'bg-secondary/30',
                    ].join(' ')}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {formatDateTime(carga.created_at)}
                    </td>

                    {/* Filename */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-primary" />
                        <span
                          className="text-xs text-foreground truncate max-w-[200px]"
                          title={carga.archivo}
                        >
                          {carga.archivo}
                        </span>
                      </div>
                    </td>

                    {/* Row count */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {carga.insertados.toLocaleString('es-CL')}
                      </span>
                      {carga.omitidos > 0 && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          (+{carga.omitidos} omitidos)
                        </span>
                      )}
                    </td>

                    {/* Status badges */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {carga.errores === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <XCircle className="w-3 h-3" />
                            {carga.errores} adv.
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs gap-1.5"
                          onClick={() => setModalCarga(carga)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Datos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60"
                          disabled={!carga.lote_id}
                          title={!carga.lote_id ? 'Importación sin lote_id — sube una nueva para poder eliminarla' : `Eliminar ${carga.insertados} registros`}
                          onClick={() => setConfirmTarget(carga)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Dialog open={!!modalCarga} onOpenChange={(open) => { if (!open) setModalCarga(null) }}>
        {/* flex flex-col + max-h-[92vh]: turns the dialog into a column where the
          header is fixed height and the body fills the rest and can scroll.
          No overflow-hidden so the inner table container can scroll freely. */}
        <DialogContent className="max-w-[98vw] w-full p-0 gap-0 flex flex-col max-h-[92vh]">
          {/* Fixed header */}
          <DialogHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base">
                  Detalle de importación
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {modalCarga?.archivo && (
                    <span className="font-mono truncate max-w-[320px]">{modalCarga.archivo}</span>
                  )}
                  {modalCarga?.created_at && (
                    <span className="text-muted-foreground/70">
                      · {formatDateTime(modalCarga.created_at)}
                    </span>
                  )}
                  {modalCarga && (
                    <span className="font-semibold text-foreground">
                      · {modalCarga.insertados.toLocaleString('es-CL')} registros
                    </span>
                  )}
                  {modalCarga && !modalCarga.lote_id && (
                    <span className="text-amber-600 dark:text-amber-400">
                      · Mostrando todos los registros del cliente
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable body — fills remaining height */}
          <div className="flex-1 min-h-0 flex flex-col px-5 py-4 gap-3 overflow-hidden">
            {modalCarga && (
              <DetalleTable clienteId={clienteId} carga={modalCarga} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog (single lote or all) */}
      <Dialog open={!!confirmTarget} onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle className="text-base">
                {confirmTarget === 'all' ? 'Eliminar todas las importaciones' : 'Eliminar importación'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              {confirmTarget === 'all' ? (
                <>Se eliminarán permanentemente{' '}
                  <strong className="text-foreground">
                    {cargas.reduce((s, c) => s + c.insertados, 0).toLocaleString('es-CL')} registros
                  </strong>{' '}
                  de{' '}
                  <strong className="text-foreground">{cargas.length} importaciones</strong>.
                </>
              ) : confirmTarget && confirmTarget !== 'all' ? (
                <>Se eliminarán{' '}
                  <strong className="text-foreground">
                    {confirmTarget.insertados.toLocaleString('es-CL')} registros
                  </strong>{' '}
                  del archivo{' '}
                  <span className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">
                    {confirmTarget.archivo}
                  </span>.
                </>
              ) : null}
            </DialogDescription>

            {/* amber notice — must live OUTSIDE <DialogDescription> which renders as <p> */}
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              Tendrás <strong>{UNDO_SECONDS} segundos</strong> para deshacer antes de que sea permanente.
            </div>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" size="sm" onClick={() => setConfirmTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => {
                if (confirmTarget === 'all') handleDeleteAll()
                else if (confirmTarget) handleDeleteLote(confirmTarget)
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Sí, eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
