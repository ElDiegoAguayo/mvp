'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  obtenerDocumentosClasificados,
  reabrirDocumentosParaEditar,
  clasificarDocumentos,
  type DocumentoClasificado,
  type CentroAsignado,
} from '@/app/actions/clasificacion'
import {
  obtenerTaxonomiaParaSheet,
  type TaxonomiaParaSheet,
} from '@/app/actions/taxonomy'
import type { GastoPorContraparte } from '@/app/actions/costos-gastos'
import {
  Loader2,
  CheckCircle2,
  Tag,
  Pencil,
  RotateCcw,
  Split,
  AlertCircle,
  Save,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { AsignacionPanel } from './asignacion-panel'
import { usePagination } from '@/hooks/use-pagination'
import { TablePaginationBar } from '@/components/ui/table-pagination-bar'
import { useLocale } from '@/components/i18n/locale-provider'

const PAGE_SIZE = 10

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatCLP(v: number | null | undefined) {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(v))
}

function fmt(v: string | null | undefined) {
  return v && v.trim() ? v : '—'
}

function colLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtVal(val: unknown): string {
  if (val == null || val === '') return '—'
  const s = String(val)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s.slice(0, 8) + '…'
  return s.length > 80 ? s.slice(0, 77) + '…' : s
}

// ─────────────────────────────────────────────────────────────────────────────
// CentrosBadges — always-visible assignment details
// ─────────────────────────────────────────────────────────────────────────────

function CentrosBadges({ centros }: { centros: CentroAsignado[] }) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)

  if (centros.length === 0) {
    return <span className="text-[11px] text-muted-foreground/50 italic">{t('costosGastos.clasificados.sinAsignacion')}</span>
  }

  // Collect extra_cols configured by admin (same columns as the picker shows)
  const pickerCols = centros.reduce<string[]>((acc, c) => {
    for (const col of c.extra_cols ?? []) {
      if (!acc.includes(col)) acc.push(col)
    }
    return acc
  }, [])

  return (
    <div className="space-y-1">
      {/* Summary — always visible: same fields as picker header */}
      <div className="space-y-1">
        {centros.map((c, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Split className="w-2.5 h-2.5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-medium text-primary">{c.label}</span>
              <span className="mx-1 text-muted-foreground/40 text-[10px]">·</span>
              <span className="text-[10px] font-mono text-foreground font-medium">{fmtVal(c.entidad_id)}</span>
              {c.nombre && (
                <span className="ml-1 text-[10px] text-foreground"> {c.nombre}</span>
              )}
              {(c.extra_cols ?? []).map((col) => (
                <span key={col} className="ml-1.5 text-[10px] text-muted-foreground">
                  <span className="opacity-50">{colLabel(col)}:</span> {fmtVal(c.extra_data?.[col])}
                </span>
              ))}
              <span className="ml-1.5 text-[10px] font-semibold text-primary tabular-nums">{formatCLP(c.monto_asignado)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Toggle full table */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {expanded ? t('costosGastos.clasificados.ocultarTabla') : t('costosGastos.clasificados.verTablaCompleta')}
      </button>

      {/* Expanded: same columns as picker (código + nombre + cols_extra) */}
      {expanded && (
        <div className="mt-1 rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-secondary/40 border-b border-border">
              <tr>
                <th className="text-left font-semibold text-muted-foreground px-2 py-1.5 whitespace-nowrap">{t('costosGastos.common.modulo')}</th>
                <th className="text-left font-semibold text-muted-foreground px-2 py-1.5 whitespace-nowrap">{t('costosGastos.common.codigo')}</th>
                <th className="text-left font-semibold text-muted-foreground px-2 py-1.5 whitespace-nowrap">{t('costosGastos.common.nombre')}</th>
                {pickerCols.map((k) => (
                  <th key={k} className="text-left font-semibold text-muted-foreground px-2 py-1.5 whitespace-nowrap">
                    {colLabel(k)}
                  </th>
                ))}
                <th className="text-right font-semibold text-primary px-2 py-1.5 whitespace-nowrap">{t('costosGastos.common.montoAsignado')}</th>
              </tr>
            </thead>
            <tbody>
              {centros.map((c, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-secondary/20">
                  <td className="px-2 py-1.5 text-primary font-medium whitespace-nowrap">{c.label}</td>
                  <td className="px-2 py-1.5 font-mono font-semibold text-foreground whitespace-nowrap">{fmtVal(c.entidad_id)}</td>
                  <td className="px-2 py-1.5 text-foreground font-medium whitespace-nowrap">{c.nombre || '—'}</td>
                  {pickerCols.map((k) => (
                    <td key={k} className="px-2 py-1.5 text-muted-foreground whitespace-nowrap max-w-[180px] truncate" title={String(c.extra_data?.[k] ?? '')}>
                      {fmtVal(c.extra_data?.[k])}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right tabular-nums font-bold text-primary whitespace-nowrap">
                    {formatCLP(c.monto_asignado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineEditor — edit taxonomy + cost center directly in the classified sheet
// ─────────────────────────────────────────────────────────────────────────────

type RowState = Record<number, string>

interface InlineEditorProps {
  doc: DocumentoClasificado
  taxonomy: TaxonomiaParaSheet
  clienteId: string
  onSaved: () => void
  onCancel: () => void
}

function InlineEditor({ doc, taxonomy, clienteId, onSaved, onCancel }: InlineEditorProps) {
  const { t } = useLocale()
  // Pre-fill from existing classification
  const initialState: RowState = {}
  taxonomy.niveles.forEach((n, i) => {
    const val = i === 0 ? doc.categoria_madre : i === 1 ? doc.sub_cuenta : i === 2 ? doc.detalle_gasto : ''
    if (val) initialState[n.numero] = val
  })

  const [rowState, setRowState] = useState<RowState>(initialState)
  const [saving, setSaving] = useState(false)
  const [asignPanelOpen, setAsignPanelOpen] = useState(false)

  const handleChange = (nivelNum: number, val: string) => {
    setRowState((prev) => {
      const next: RowState = {}
      for (const [k, v] of Object.entries(prev)) {
        if (Number(k) <= nivelNum) next[Number(k)] = v
      }
      next[nivelNum] = val
      // Clear subsequent levels
      taxonomy.niveles.forEach((n) => {
        if (n.numero > nivelNum) delete next[n.numero]
      })
      return next
    })
  }

  const handleSave = async () => {
    const niveles = taxonomy.niveles
    const vals = niveles.map((n) => rowState[n.numero] ?? '')
    const [cat, sub, det] = vals

    setSaving(true)
    try {
      const res = await clasificarDocumentos(clienteId, [{
        id: doc.id,
        categoria_madre: cat ?? '',
        sub_cuenta: sub ?? '',
        detalle_gasto: det ?? '',
        estado_clasificacion: 'completado',
      }])
      if (res.ok) {
        toast.success(t('costosGastos.clasificados.edit.updatedSuccess'))
        onSaved()
      } else {
        toast.error(res.message)
      }
    } catch (err) {
      toast.error(t('costosGastos.common.errorWithMessage', {
        message: err instanceof Error ? err.message : String(err),
      }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-4 rounded-xl border border-primary/20 bg-primary/3">
      {/* Doc header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Pencil className="w-3.5 h-3.5 text-primary shrink-0" />
          {t('costosGastos.clasificados.edit.editingLabel', { numero: doc.numero_documento })}
          <span className="text-muted-foreground font-normal">{doc.tipo_documento} · {doc.fecha_emision ?? '—'} · {formatCLP(doc.monto_bruto)}</span>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Taxonomy dropdowns */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-2">{t('costosGastos.clasificados.edit.clasificacion')}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {taxonomy.niveles.map((nivel, i) => {
            const opts = taxonomy.opciones[nivel.numero] ?? []
            const prev = taxonomy.niveles[i - 1]
            const isDisabled = prev ? !rowState[prev.numero] : false
            const value = rowState[nivel.numero] ?? ''
            return (
              <div key={nivel.numero} className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground font-medium">{nivel.label}</span>
                <Select value={value} onValueChange={(v) => handleChange(nivel.numero, v)} disabled={isDisabled}>
                  <SelectTrigger className="h-8 text-xs w-[160px]">
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
              </div>
            )
          })}
        </div>
      </div>

      {/* Cost center assignment */}
      <div>
        <button
          onClick={() => setAsignPanelOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
        >
          {asignPanelOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Split className="w-3 h-3" />
          {t('costosGastos.common.centroDeCosto')}
          {doc.centros_asignados.length > 0 && (
            <span className="text-[10px] text-emerald-500 font-normal ml-1">
              {t('costosGastos.clasificados.edit.asignadosCount', { count: doc.centros_asignados.length })}
            </span>
          )}
        </button>
        {asignPanelOpen && (
          <AsignacionPanel
            facturaId={doc.id}
            clienteId={clienteId}
            montoBruto={doc.monto_bruto}
            numeroDocumento={doc.numero_documento}
            onSaved={() => {}}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end pt-1 border-t border-border/40">
        <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-8 gap-1.5">
          <X className="w-3.5 h-3.5" /> {t('common.actions.cancel')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs h-8 gap-1.5">
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('costosGastos.common.guardando')}</>
            : <><Save className="w-3.5 h-3.5" /> {t('costosGastos.common.guardarCambios')}</>
          }
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contraparte: GastoPorContraparte | null
  clienteId: string
  onReclasificar?: (rut: string) => void
}

export function DocumentosClasificadosSheet({
  open,
  onOpenChange,
  contraparte,
  clienteId,
  onReclasificar,
}: Props) {
  const { t } = useLocale()
  const [docs, setDocs]           = useState<DocumentoClasificado[]>([])
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [reopening, setReopening] = useState(false)
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [taxonomy, setTaxonomy]   = useState<TaxonomiaParaSheet | null>(null)

  const load = useCallback(() => {
    if (!contraparte || !clienteId) return
    setLoading(true)
    setSelected(new Set())
    setEditingDocId(null)
    obtenerDocumentosClasificados(clienteId, contraparte.rut_contraparte)
      .then((res) => {
        if (res.ok) setDocs(res.data)
        else toast.error(res.message ?? t('costosGastos.clasificados.errorLoadDocs'))
      })
      .catch(() => toast.error(t('costosGastos.clasificados.errorLoadDocs')))
      .finally(() => setLoading(false))
  }, [contraparte, clienteId, t])

  useEffect(() => {
    if (open) {
      load()
      // Load taxonomy for inline editing
      if (clienteId) {
        obtenerTaxonomiaParaSheet(clienteId).then(setTaxonomy)
      }
    }
  }, [open, load, clienteId])

  const totalNeto  = useMemo(() => docs.reduce((s, d) => s + Number(d.monto_neto),  0), [docs])
  const totalIva   = useMemo(() => docs.reduce((s, d) => s + Number(d.monto_iva),   0), [docs])
  const totalBruto = useMemo(() => docs.reduce((s, d) => s + Number(d.monto_bruto), 0), [docs])

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
    setEditingDocId(null)
  }, [page])

  const pageAllSelected =
    paginatedItems.length > 0 && paginatedItems.every((d) => selected.has(d.id))

  const someSelected = selected.size > 0
  const hasCentros   = docs.some((d) => d.centros_asignados.length > 0)

  const toggleAll = () => {
    if (pageAllSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        paginatedItems.forEach((d) => next.delete(d.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        paginatedItems.forEach((d) => next.add(d.id))
        return next
      })
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleReopen = async (ids: string[]) => {
    setReopening(true)
    const res = await reabrirDocumentosParaEditar(clienteId, ids)
    setReopening(false)
    if (res.ok) {
      toast.success(res.message)
      onOpenChange(false)
      onReclasificar?.(contraparte!.rut_contraparte)
    } else {
      toast.error(res.message)
    }
  }

  const COLS = useMemo(() => [
    { key: 'numero_documento' as const, label: t('costosGastos.common.numeroDocumento') },
    { key: 'tipo_documento'   as const, label: t('costosGastos.common.tipo') },
    { key: 'fecha_emision'    as const, label: t('costosGastos.common.fechaEmision') },
    { key: 'monto_neto'       as const, label: t('costosGastos.common.neto'),   align: 'right' as const, money: true },
    { key: 'monto_iva'        as const, label: t('costosGastos.common.iva'),    align: 'right' as const, money: true },
    { key: 'monto_bruto'      as const, label: t('costosGastos.common.bruto'),  align: 'right' as const, money: true },
    { key: 'categoria_madre'  as const, label: t('costosGastos.clasificacion.taxonomy.cuentaMadre') },
    { key: 'sub_cuenta'       as const, label: t('costosGastos.clasificacion.taxonomy.subCuenta') },
    { key: 'detalle_gasto'    as const, label: t('costosGastos.clasificacion.taxonomy.detalle') },
  ], [t])

  if (!contraparte) return null

  // Total cols: checkbox + # + COLS + (centros?) + edit
  const totalCols = 2 + COLS.length + (hasCentros ? 1 : 0) + 1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[98vw] flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <SheetTitle className="text-lg font-bold leading-snug">
                  {contraparte.razon_social}
                </SheetTitle>
              </div>
              <SheetDescription className="font-mono text-xs">
                {t('costosGastos.common.rutPrefix', { rut: contraparte.rut_contraparte })}
              </SheetDescription>
            </div>

            {/* Action buttons */}
            {!loading && docs.length > 0 && (
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px]">
                  {t('costosGastos.clasificados.badge.clasificados', { count: docs.length })}
                </Badge>

                {someSelected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReopen([...selected])}
                    disabled={reopening}
                    className="gap-1.5 text-xs h-7 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    {reopening
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Pencil className="w-3.5 h-3.5" />
                    }
                    {t('costosGastos.clasificados.actions.editSelected', { count: selected.size })}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReopen(docs.map((d) => d.id))}
                  disabled={reopening}
                  className="gap-1.5 text-xs h-7 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  {reopening
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RotateCcw className="w-3.5 h-3.5" />
                  }
                  {t('costosGastos.clasificados.actions.reclasificarTodo')}
                </Button>
              </div>
            )}
          </div>

          {/* Totals */}
          {!loading && docs.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[
                { label: t('costosGastos.common.totalNeto'),  value: totalNeto },
                { label: t('costosGastos.common.totalIva'),   value: totalIva },
                { label: t('costosGastos.common.totalBruto'), value: totalBruto, bold: true },
              ].map(({ label, value, bold }) => (
                <div key={label} className="rounded-lg bg-secondary/40 border border-border px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{label}</p>
                  <p className={`tabular-nums text-foreground ${bold ? 'text-base font-bold' : 'text-sm font-semibold'}`}>
                    {formatCLP(value)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {someSelected && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 mt-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {t('costosGastos.clasificados.editSelectedHint')}
            </div>
          )}
        </SheetHeader>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center px-6">
              <Tag className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">{t('costosGastos.clasificados.empty.title')}</p>
              <p className="text-xs text-muted-foreground">
                {t('costosGastos.clasificados.empty.description')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto h-full">
              <table
                className="text-xs border-collapse"
                style={{ minWidth: `${COLS.length * 130 + (hasCentros ? 220 : 0) + 80}px` }}
              >
                <thead className="sticky top-0 z-10 bg-background border-b border-border">
                  <tr>
                    <th className="w-10 px-3 py-2.5 border-r border-border/40">
                      <input
                        type="checkbox"
                        checked={pageAllSelected}
                        onChange={toggleAll}
                        className="rounded border-border accent-primary"
                        title={t('costosGastos.clasificados.selectPageTitle')}
                      />
                    </th>
                    <th className="text-left font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap border-r border-border/40">#</th>
                    {COLS.map((col) => (
                      <th
                        key={col.key}
                        className={`font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        } ${col.key === 'categoria_madre' ? 'border-l border-primary/20 bg-primary/5' : ''}`}
                      >
                        {col.label}
                      </th>
                    ))}
                    {hasCentros && (
                      <th className="text-left font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap border-l border-primary/20 bg-primary/5">
                        {t('costosGastos.common.centroDeCosto')}
                      </th>
                    )}
                    <th className="w-20 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((doc, idx) => {
                    const isSelected = selected.has(doc.id)
                    const isEditing  = editingDocId === doc.id
                    const rowNum = startIndex + idx + 1
                    return [
                      <tr
                        key={doc.id}
                        className={`border-b border-border/30 transition-colors ${
                          isEditing ? 'bg-primary/5' : isSelected ? 'bg-amber-500/5' : 'hover:bg-primary/3'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2 border-r border-border/30" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(doc.id)}
                            className="rounded border-border accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground/60 tabular-nums border-r border-border/30">
                          {rowNum}
                        </td>
                        {COLS.map((col) => {
                          const raw = doc[col.key]
                          const display = col.money
                            ? formatCLP(raw as number)
                            : fmt(raw as string)
                          return (
                            <td
                              key={col.key}
                              className={`px-3 py-2 whitespace-nowrap ${
                                col.align === 'right' ? 'text-right tabular-nums' : ''
                              } ${col.key === 'monto_bruto' ? 'font-semibold text-foreground' : 'text-muted-foreground'} ${
                                col.key === 'categoria_madre'
                                  ? 'border-l border-primary/20 bg-primary/5 font-medium text-foreground'
                                  : ''
                              } ${col.key === 'numero_documento' ? 'font-mono text-foreground' : ''}`}
                            >
                              {display}
                            </td>
                          )
                        })}
                        {hasCentros && (
                          <td className="px-3 py-2 border-l border-primary/20 bg-primary/5 min-w-[220px] max-w-[280px]">
                            <CentrosBadges centros={doc.centros_asignados} />
                          </td>
                        )}
                        {/* Edit button per row */}
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setEditingDocId(isEditing ? null : doc.id)}
                            title={isEditing ? t('costosGastos.clasificados.edit.closeEditor') : t('costosGastos.clasificados.edit.editDocument')}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border transition-colors ${
                              isEditing
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
                            }`}
                          >
                            <Pencil className="w-3 h-3" />
                            {isEditing ? t('common.actions.close') : t('common.actions.edit')}
                          </button>
                        </td>
                      </tr>,

                      /* Inline editor row */
                      isEditing && taxonomy ? (
                        <tr key={`edit-${doc.id}`} className="border-b border-primary/20 bg-primary/3">
                          <td colSpan={totalCols} className="px-4 py-3">
                            <InlineEditor
                              doc={doc}
                              taxonomy={taxonomy}
                              clienteId={clienteId}
                              onSaved={() => { setEditingDocId(null); load() }}
                              onCancel={() => setEditingDocId(null)}
                            />
                          </td>
                        </tr>
                      ) : null,
                    ]
                  })}
                </tbody>
                {/* Totals footer */}
                <tfoot className="sticky bottom-0 bg-background border-t-2 border-border">
                  <tr>
                    <td colSpan={2} className="px-3 py-2.5 text-[11px] font-bold text-foreground border-r border-border/40">
                      {t('costosGastos.common.total')}
                    </td>
                    {COLS.map((col) => {
                      if (col.money) {
                        const sum = docs.reduce((s, d) => s + Number(d[col.key] ?? 0), 0)
                        return (
                          <td
                            key={col.key}
                            className={`px-3 py-2.5 text-right tabular-nums text-[11px] font-bold whitespace-nowrap ${
                              col.key === 'monto_bruto' ? 'text-foreground' : 'text-muted-foreground'
                            } ${col.key === 'categoria_madre' ? 'border-l border-primary/20 bg-primary/5' : ''}`}
                          >
                            {formatCLP(sum)}
                          </td>
                        )
                      }
                      return (
                        <td
                          key={col.key}
                          className={col.key === 'categoria_madre' ? 'border-l border-primary/20 bg-primary/5' : ''}
                        />
                      )
                    })}
                    {hasCentros && <td className="border-l border-primary/20 bg-primary/5" />}
                    <td />
                  </tr>
                </tfoot>
              </table>
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
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
