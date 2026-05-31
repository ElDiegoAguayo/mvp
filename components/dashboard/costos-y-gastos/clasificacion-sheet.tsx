'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  obtenerDocumentosPorContraparte,
  clasificarDocumentos,
  type DocumentoPendiente,
  type ClasificacionUpdate,
} from '@/app/actions/clasificacion'
import {
  obtenerTaxonomiaParaSheet,
  type TaxonomiaParaSheet,
} from '@/app/actions/taxonomy'
import type { GastoPorContraparte } from '@/app/actions/costos-gastos'
import { Loader2, CheckCircle2, FileX, Split, Columns } from 'lucide-react'
import { toast } from 'sonner'
import { AsignacionPanel } from './asignacion-panel'
import { usePagination } from '@/hooks/use-pagination'
import { TablePaginationBar } from '@/components/ui/table-pagination-bar'
import { useLocale } from '@/components/i18n/locale-provider'

const PAGE_SIZE = 10

// ─────────────────────────────────────────────────────────────────────────────
// Optional column definitions
// ─────────────────────────────────────────────────────────────────────────────

type OptColKey =
  | 'fecha_devengo' | 'fecha_vencimiento' | 'tipo_obligacion'
  | 'monto_exento' | 'iva_no_recuperable' | 'otros_impuestos'
  | 'retencion_honorarios' | 'monto_base' | 'monto_calculado'
  | 'porcentaje' | 'anula_o_modifica'

interface OptColDef {
  key: OptColKey
  labelKey: string
  groupKey: string
  numeric?: boolean
}

const OPT_COLUMN_DEFS: OptColDef[] = [
  { key: 'fecha_devengo',       labelKey: 'costosGastos.clasificacion.columns.fechaDevengo',     groupKey: 'costosGastos.clasificacion.columnGroups.fechas' },
  { key: 'fecha_vencimiento',   labelKey: 'costosGastos.clasificacion.columns.fechaVencimiento', groupKey: 'costosGastos.clasificacion.columnGroups.fechas' },
  { key: 'tipo_obligacion',     labelKey: 'costosGastos.clasificacion.columns.tipoObligacion',   groupKey: 'costosGastos.clasificacion.columnGroups.otros' },
  { key: 'monto_exento',        labelKey: 'costosGastos.clasificacion.columns.montoExento',      groupKey: 'costosGastos.clasificacion.columnGroups.montos',  numeric: true },
  { key: 'iva_no_recuperable',  labelKey: 'costosGastos.clasificacion.columns.ivaNoRecuperable', groupKey: 'costosGastos.clasificacion.columnGroups.montos',  numeric: true },
  { key: 'otros_impuestos',     labelKey: 'costosGastos.clasificacion.columns.otrosImpuestos',   groupKey: 'costosGastos.clasificacion.columnGroups.montos',  numeric: true },
  { key: 'retencion_honorarios',labelKey: 'costosGastos.clasificacion.columns.retencionHonorarios', groupKey: 'costosGastos.clasificacion.columnGroups.montos', numeric: true },
  { key: 'monto_base',          labelKey: 'costosGastos.clasificacion.columns.montoBase',        groupKey: 'costosGastos.clasificacion.columnGroups.calculo', numeric: true },
  { key: 'monto_calculado',     labelKey: 'costosGastos.clasificacion.columns.montoCalculado',   groupKey: 'costosGastos.clasificacion.columnGroups.calculo', numeric: true },
  { key: 'porcentaje',          labelKey: 'costosGastos.clasificacion.columns.porcentaje',       groupKey: 'costosGastos.clasificacion.columnGroups.calculo', numeric: true },
  { key: 'anula_o_modifica',    labelKey: 'costosGastos.clasificacion.columns.anulaModifica',    groupKey: 'costosGastos.clasificacion.columnGroups.otros' },
]

const OPT_GROUP_KEYS = [
  'costosGastos.clasificacion.columnGroups.fechas',
  'costosGastos.clasificacion.columnGroups.otros',
  'costosGastos.clasificacion.columnGroups.montos',
  'costosGastos.clasificacion.columnGroups.calculo',
] as const

function ColumnPicker({
  visible,
  onChange,
}: {
  visible: Set<OptColKey>
  onChange: (key: OptColKey, checked: boolean) => void
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
          open || visible.size > 0
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
        }`}
        title={t('costosGastos.clasificacion.columnPicker.title')}
      >
        <Columns className="w-3.5 h-3.5" />
        {t('costosGastos.clasificacion.columnPicker.button')}
        {visible.size > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
            {visible.size}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{t('costosGastos.clasificacion.columnPicker.header')}</span>
              <button
                onClick={() => { OPT_COLUMN_DEFS.forEach((c) => onChange(c.key, false)) }}
                className="text-[11px] text-muted-foreground hover:text-destructive"
              >
                {t('costosGastos.common.limpiar')}
              </button>
            </div>
            <div className="p-2 max-h-72 overflow-y-auto">
              {OPT_GROUP_KEYS.map((groupKey) => (
                <div key={groupKey} className="mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">{t(groupKey)}</p>
                  {OPT_COLUMN_DEFS.filter((c) => c.groupKey === groupKey).map((col) => (
                    <label key={col.key} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-secondary/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visible.has(col.key)}
                        onChange={(e) => onChange(col.key, e.target.checked)}
                        className="rounded border-border accent-primary"
                      />
                      <span className="text-xs text-foreground">{t(col.labelKey)}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatCLP(v: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(v)
}

/** One selection per nivel_numero */
type RowState = Record<number, string>

function initRows(docs: DocumentoPendiente[]): Record<string, RowState> {
  return Object.fromEntries(
    docs.map((d) => [
      d.id,
      {
        1: d.categoria_madre || '',
        2: d.sub_cuenta || '',
        3: d.detalle_gasto || '',
      } as RowState,
    ]),
  )
}

const DEFAULT_TAXONOMY = (t: (key: string) => string): TaxonomiaParaSheet => ({
  niveles: [
    { numero: 1, label: t('costosGastos.clasificacion.taxonomy.cuentaMadre') },
    { numero: 2, label: t('costosGastos.clasificacion.taxonomy.subCuenta') },
    { numero: 3, label: t('costosGastos.clasificacion.taxonomy.detalle') },
  ],
  opciones: {},
})

// ─────────────────────────────────────────────────────────────────────────────
// Row selects — one Select per active nivel
// ─────────────────────────────────────────────────────────────────────────────

interface RowSelectsProps {
  rowState: RowState
  taxonomy: TaxonomiaParaSheet
  onChange: (nivelNumero: number, value: string) => void
}

function RowSelects({ rowState, taxonomy, onChange }: RowSelectsProps) {
  const { t } = useLocale()
  return (
    <>
      {taxonomy.niveles.map((nivel) => {
        const opts = taxonomy.opciones[nivel.numero] ?? []
        const prev = taxonomy.niveles.find((n) => n.numero < nivel.numero)
        const isDisabled = prev ? !rowState[prev.numero] : false
        const value = rowState[nivel.numero] ?? ''

        return (
          <td key={nivel.numero} className="py-1.5 pr-2">
            <Select
              value={value}
              onValueChange={(v) => onChange(nivel.numero, v)}
              disabled={isDisabled}
            >
              <SelectTrigger className="h-7 text-[11px] w-[145px]">
                <SelectValue placeholder={isDisabled ? '—' : t('costosGastos.clasificacion.selectPlaceholder', { label: nivel.label })} />
              </SelectTrigger>
              <SelectContent>
                {opts.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                ))}
                {opts.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground italic">{t('costosGastos.clasificacion.noOptions')}</div>
                )}
              </SelectContent>
            </Select>
          </td>
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contraparte: GastoPorContraparte | null
  clienteId: string
  onGuardado: () => void
}

export function ClasificacionSheet({
  open,
  onOpenChange,
  contraparte,
  clienteId,
  onGuardado,
}: Props) {
  const { t } = useLocale()
  const [docs, setDocs]             = useState<DocumentoPendiente[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [rows, setRows]             = useState<Record<string, RowState>>({})
  const [saving, setSaving]         = useState(false)
  const [taxonomy, setTaxonomy]     = useState<TaxonomiaParaSheet>(() => DEFAULT_TAXONOMY(t))
  const [expandedAsignacion, setExpandedAsignacion] = useState<string | null>(null)
  const [visibleCols, setVisibleCols] = useState<Set<OptColKey>>(new Set())

  const toggleCol = useCallback((key: OptColKey, checked: boolean) => {
    setVisibleCols((prev) => {
      const next = new Set(prev)
      checked ? next.add(key) : next.delete(key)
      return next
    })
  }, [])

  // ── Fetch docs + taxonomy when sheet opens ──────────────────────────────

  useEffect(() => {
    if (!open || !contraparte || !clienteId) return

    setDocs([])
    setRows({})
    setBatchState({})
    setLoadingDocs(true)

    Promise.all([
      obtenerDocumentosPorContraparte(clienteId, contraparte.rut_contraparte),
      obtenerTaxonomiaParaSheet(clienteId),
    ])
      .then(([docsRes, taxRes]) => {
        if (docsRes.ok) {
          setDocs(docsRes.data)
          setRows(initRows(docsRes.data))
        } else {
          toast.error(docsRes.message ?? t('costosGastos.clasificacion.errorLoadDocs'))
        }
        setTaxonomy(taxRes)
      })
      .catch(() => toast.error(t('costosGastos.clasificacion.errorLoadDocs')))
      .finally(() => setLoadingDocs(false))
  }, [open, contraparte?.rut_contraparte, clienteId])

  // ── Row-level state update ───────────────────────────────────────────────

  const updateRow = useCallback((docId: string, nivelNumero: number, value: string) => {
    setRows((prev) => {
      const cur = prev[docId] ?? {}
      const updated: RowState = { ...cur, [nivelNumero]: value }
      // Clear levels after the changed one
      taxonomy.niveles
        .filter((n) => n.numero > nivelNumero)
        .forEach((n) => { updated[n.numero] = '' })
      return { ...prev, [docId]: updated }
    })
  }, [taxonomy.niveles])

  // ── Check if a row is fully classified ──────────────────────────────────

  const isRowComplete = useCallback((state: RowState) => {
    return taxonomy.niveles.every((n) => !!state[n.numero])
  }, [taxonomy.niveles])

  const completedCount = useMemo(
    () => Object.values(rows).filter(isRowComplete).length,
    [rows, isRowComplete],
  )

  const [batchState, setBatchState] = useState<RowState>({})

  const applyBatchToAll = useCallback(() => {
    const first = taxonomy.niveles[0]
    if (!first || !batchState[first.numero]) {
      toast.error(t('costosGastos.clasificacion.batch.firstLevelRequired'))
      return
    }
    setRows((prev) => {
      const next = { ...prev }
      for (const doc of docs) {
        if (isRowComplete(prev[doc.id] ?? {})) continue
        next[doc.id] = { ...batchState }
      }
      return next
    })
    toast.success(t('costosGastos.clasificacion.batch.appliedSuccess'))
  }, [batchState, docs, isRowComplete, taxonomy.niveles, t])

  const {
    page,
    setPage,
    totalPages,
    totalItems,
    paginatedItems,
    startIndex,
    endIndex,
    hasPagination,
  } = usePagination(docs, PAGE_SIZE)

  useEffect(() => {
    setExpandedAsignacion(null)
  }, [page])

  // ── Save ────────────────────────────────────────────────────────────────

  const handleGuardar = async () => {
    const firstLevel = taxonomy.niveles[0]
    const updates: ClasificacionUpdate[] = docs
      .filter((d) => rows[d.id]?.[firstLevel?.numero ?? 1])
      .map((d) => {
        const r = rows[d.id] ?? {}
        return {
          id: d.id,
          categoria_madre: r[1] ?? r[taxonomy.niveles[0]?.numero ?? 1] ?? '',
          sub_cuenta: r[2] ?? r[taxonomy.niveles[1]?.numero ?? 2] ?? '',
          detalle_gasto: r[3] ?? r[taxonomy.niveles[2]?.numero ?? 3] ?? '',
          estado_clasificacion: isRowComplete(r) ? 'completado' : 'pendiente',
        } satisfies ClasificacionUpdate
      })

    if (updates.length === 0) {
      toast.error(t('costosGastos.clasificacion.save.firstLevelRequired'))
      return
    }

    setSaving(true)
    try {
      const res = await clasificarDocumentos(clienteId, updates)
      if (res.ok) {
        toast.success(res.message)
        onGuardado()
        onOpenChange(false)
      } else {
        toast.error(res.message)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('costosGastos.clasificacion.save.error'))
    } finally {
      setSaving(false)
    }
  }

  if (!contraparte) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[90vw] xl:max-w-[80vw] flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-bold leading-snug">
                {contraparte.razon_social}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs mt-0.5">
                {t('costosGastos.common.rutPrefix', { rut: contraparte.rut_contraparte })}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {loadingDocs ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  {docs.length > 0 && (
                    <Badge className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px]">
                      {t('costosGastos.clasificacion.badge.pending', { count: docs.length - completedCount })}
                    </Badge>
                  )}
                  {completedCount > 0 && (
                    <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px]">
                      <CheckCircle2 className="w-3 h-3" />
                      {t('costosGastos.clasificacion.badge.ready', { count: completedCount })}
                    </Badge>
                  )}
                  <ColumnPicker visible={visibleCols} onChange={toggleCol} />
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        {!loadingDocs && docs.length > 0 && (
          <div className="shrink-0 px-6 py-3 border-b border-border bg-secondary/20 space-y-2">
            <p className="text-xs font-semibold text-foreground">{t('costosGastos.clasificacion.batch.title')}</p>
            <p className="text-[11px] text-muted-foreground">
              {t('costosGastos.clasificacion.batch.description')}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <table className="text-xs">
                <tbody>
                  <tr>
                    {taxonomy.niveles.map((nivel) => {
                      const opts = taxonomy.opciones[nivel.numero] ?? []
                      const prev = taxonomy.niveles.find((n) => n.numero < nivel.numero)
                      const isDisabled = prev ? !batchState[prev.numero] : false
                      return (
                        <td key={nivel.numero} className="pr-2 pb-0">
                          <Select
                            value={batchState[nivel.numero] ?? ''}
                            onValueChange={(v) => {
                              setBatchState((cur) => {
                                const updated: RowState = { ...cur, [nivel.numero]: v }
                                taxonomy.niveles
                                  .filter((n) => n.numero > nivel.numero)
                                  .forEach((n) => { updated[n.numero] = '' })
                                return updated
                              })
                            }}
                            disabled={isDisabled}
                          >
                            <SelectTrigger className="h-8 text-[11px] w-[140px]">
                              <SelectValue placeholder={nivel.label} />
                            </SelectTrigger>
                            <SelectContent>
                              {opts.map((opt) => (
                                <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
              <Button type="button" size="sm" variant="secondary" onClick={applyBatchToAll}>
                {t('costosGastos.clasificacion.batch.applyToAll', { count: docs.length - completedCount })}
              </Button>
            </div>
          </div>
        )}


        {/* Document rows */}
        <div className="flex-1 min-h-0 overflow-auto">
          {loadingDocs ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center px-6">
              <FileX className="w-10 h-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">{t('costosGastos.clasificacion.empty.title')}</p>
              <p className="text-xs text-muted-foreground">
                {t('costosGastos.clasificacion.empty.description')}
              </p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table
                className="w-full text-xs"
                style={{ minWidth: `${780 + taxonomy.niveles.length * 155 + visibleCols.size * 120}px` }}
              >
                <thead className="sticky top-0 z-10 bg-background border-b border-border">
                  <tr>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">#</th>
                    <th className="text-left font-semibold text-muted-foreground px-2 py-2.5 whitespace-nowrap">{t('costosGastos.common.numeroDocumento')}</th>
                    <th className="text-left font-semibold text-muted-foreground px-2 py-2.5 whitespace-nowrap">{t('costosGastos.clasificacion.columns.tipoDocumento')}</th>
                    <th className="text-left font-semibold text-muted-foreground px-2 py-2.5 whitespace-nowrap">{t('costosGastos.common.fechaEmision')}</th>
                    <th className="text-right font-semibold text-muted-foreground px-2 py-2.5 whitespace-nowrap">{t('costosGastos.common.montoNeto')}</th>
                    <th className="text-right font-semibold text-muted-foreground px-2 py-2.5 whitespace-nowrap">{t('costosGastos.common.iva')}</th>
                    <th className="text-right font-semibold text-muted-foreground px-2 py-2.5 whitespace-nowrap">{t('costosGastos.common.montoBruto')}</th>
                    {OPT_COLUMN_DEFS.filter((c) => visibleCols.has(c.key)).map((c) => (
                      <th key={c.key} className={`font-semibold text-muted-foreground px-2 py-2.5 whitespace-nowrap ${c.numeric ? 'text-right' : 'text-left'}`}>
                        {t(c.labelKey)}
                      </th>
                    ))}
                    {taxonomy.niveles.map((n) => (
                      <th key={n.numero} className="text-left font-semibold text-muted-foreground px-2 py-2.5 whitespace-nowrap">
                        {n.label}
                      </th>
                    ))}
                    <th className="py-2.5 px-2 whitespace-nowrap text-left font-semibold text-muted-foreground">{t('costosGastos.clasificacion.table.asignar')}</th>
                    <th className="py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((doc, idx) => {
                    const row = rows[doc.id] ?? {}
                    const isComplete = isRowComplete(row)
                    const asignacionOpen = expandedAsignacion === doc.id
                    const totalCols = 8 + visibleCols.size + taxonomy.niveles.length
                    const rowNum = startIndex + idx + 1

                    return [
                      <tr
                        key={doc.id}
                        className={`border-b border-border/40 transition-colors hover:bg-primary/5 ${isComplete ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-1.5 text-muted-foreground tabular-nums">{rowNum}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{doc.numero_documento || '—'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{doc.tipo_documento || '—'}</td>
                        <td className="px-2 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{doc.fecha_emision || '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                          {formatCLP(doc.monto_neto)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                          {formatCLP(doc.monto_iva)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold whitespace-nowrap">
                          {formatCLP(doc.monto_bruto)}
                        </td>
                        {OPT_COLUMN_DEFS.filter((c) => visibleCols.has(c.key)).map((c) => {
                          const val = doc[c.key as keyof DocumentoPendiente]
                          const display = val == null ? '—'
                            : c.numeric ? formatCLP(Number(val))
                            : String(val)
                          return (
                            <td key={c.key} className={`px-2 py-1.5 whitespace-nowrap text-muted-foreground ${c.numeric ? 'text-right tabular-nums' : ''}`}>
                              {display}
                            </td>
                          )
                        })}
                        <RowSelects
                          rowState={row}
                          taxonomy={taxonomy}
                          onChange={(nivelNum, val) => updateRow(doc.id, nivelNum, val)}
                        />
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => setExpandedAsignacion(asignacionOpen ? null : doc.id)}
                            title={t('costosGastos.clasificacion.assignTooltip')}
                            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition-colors ${
                              asignacionOpen
                                ? 'border-primary/50 bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
                            }`}
                          >
                            <Split className="w-3 h-3 shrink-0" />
                            {t('costosGastos.clasificacion.assignButton')}
                          </button>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {isComplete && <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />}
                        </td>
                      </tr>,

                      asignacionOpen && (
                        <tr key={`asig-${doc.id}`} className="bg-secondary/20">
                          <td colSpan={totalCols} className="px-4 py-3">
                            <AsignacionPanel
                              facturaId={doc.id}
                              clienteId={clienteId}
                              montoBruto={doc.monto_bruto}
                              numeroDocumento={doc.numero_documento}
                              onSaved={() => { setExpandedAsignacion(null) }}
                            />
                          </td>
                        </tr>
                      ),
                    ]
                  })}
                </tbody>
              </table>
            </div>
              {hasPagination && (
                <TablePaginationBar
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  startIndex={startIndex}
                  endIndex={endIndex}
                  onPageChange={setPage}
                  itemLabel={t('costosGastos.common.itemLabel.documentos')}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loadingDocs && docs.length > 0 && (
          <SheetFooter className="shrink-0 px-6 py-4 border-t border-border">
            <div className="flex items-center justify-between w-full gap-4">
              <p className="text-xs text-muted-foreground">
                {t('costosGastos.clasificacion.footer.progress', {
                  completed: completedCount,
                  total: docs.length,
                })}
              </p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleGuardar}
                  disabled={saving || completedCount === 0}
                >
                  {saving ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('costosGastos.common.guardando')}</>
                  ) : (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> {t('costosGastos.clasificacion.footer.saveButton', { count: completedCount })}</>
                  )}
                </Button>
              </div>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
