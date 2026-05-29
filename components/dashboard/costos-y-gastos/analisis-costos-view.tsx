'use client'

import { useState, useEffect } from 'react'
import {
  obtenerResumenCentrosCosto,
  obtenerAnalisisCostos,
  type ModuloDinamico,
  type EntidadDinamica,
  type AnalisisEntidad,
  type ResumenAnalisis,
} from '@/app/actions/analisis'
import {
  DollarSign,
  Loader2,
  BarChart3,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  TableIcon,
  FileText,
  TrendingUp,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clp(v: number | null | undefined) {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(v)
}

function pct(part: number, total: number) {
  if (!total) return '—'
  return `${((part / total) * 100).toFixed(1)}%`
}

/** Convert snake_case / camelCase column names to readable labels */
function colLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtVal(val: unknown): string {
  if (val == null || val === '') return '—'
  const s = String(val)
  // UUID: show only first 8 chars
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s.slice(0, 8) + '…'
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI bar
// ─────────────────────────────────────────────────────────────────────────────

function KpiBar({ total, numModulos, numEntidades }: { total: number; numModulos: number; numEntidades: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { icon: DollarSign, label: 'Total Gastos Asignados', value: clp(total), accent: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
        { icon: TableIcon,  label: 'Módulos con Costo',     value: String(numModulos),   accent: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/20' },
        { icon: BarChart3,  label: 'Registros Asignados',   value: String(numEntidades), accent: 'text-amber-500',  bg: 'bg-amber-500/10 border-amber-500/20' },
      ].map(({ icon: Icon, label, value, accent, bg }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
          <div className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${bg}`}>
            <Icon className={`w-4 h-4 ${accent}`} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">{label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 leading-tight ${accent}`}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Entidad row — expandable to show invoices
// ─────────────────────────────────────────────────────────────────────────────

function EntidadRow({ entidad, totalModulo, extraCols }: {
  entidad: EntidadDinamica
  totalModulo: number
  extraCols: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const totalCols = 4 + extraCols.length

  return (
    <>
      <tr
        className="border-b border-border/40 hover:bg-primary/3 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            }
            <div>
              <span className="font-semibold text-foreground text-xs">
                {entidad.entidad_nombre || entidad.entidad_id}
              </span>
              {entidad.entidad_nombre && entidad.entidad_nombre !== entidad.entidad_id && (
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">{entidad.entidad_id}</span>
              )}
            </div>
          </div>
        </td>
        {extraCols.map((col) => (
          <td key={col} className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap max-w-[160px] truncate" title={String(entidad.extra_data[col] ?? '')}>
            {fmtVal(entidad.extra_data[col])}
          </td>
        ))}
        <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums text-xs">
          {entidad.num_facturas}
        </td>
        <td className="px-3 py-2.5 text-right font-semibold text-foreground tabular-nums whitespace-nowrap text-xs">
          {clp(entidad.total_gastos)}
        </td>
        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums text-xs whitespace-nowrap">
          {pct(entidad.total_gastos, totalModulo)}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border/20">
          <td colSpan={totalCols} className="px-4 py-4 bg-secondary/10">
            <div className="space-y-4">

              {/* ── Datos del Registro (mismas columnas que el picker) ── */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TableIcon className="w-3 h-3" /> Datos del Registro
                </p>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>
                        <th className="text-left font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">Código</th>
                        <th className="text-left font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">Nombre</th>
                        {extraCols.map((k) => (
                          <th key={k} className="text-left font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">
                            {colLabel(k)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-secondary/20">
                        <td className="px-3 py-2 font-mono font-semibold text-foreground whitespace-nowrap">{entidad.entidad_id}</td>
                        <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{entidad.entidad_nombre || '—'}</td>
                        {extraCols.map((k) => (
                          <td key={k} className="px-3 py-2 text-muted-foreground whitespace-nowrap max-w-[200px] truncate" title={String(entidad.extra_data[k] ?? '')}>
                            {fmtVal(entidad.extra_data[k])}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Facturas Asignadas ── */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Facturas Asignadas ({entidad.facturas.length})
                </p>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>
                        <th className="text-left font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">N° Documento</th>
                        <th className="text-left font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">Tipo</th>
                        <th className="text-left font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">Fecha Emisión</th>
                        <th className="text-left font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">Proveedor</th>
                        <th className="text-right font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">Monto Bruto</th>
                        <th className="text-right font-semibold text-primary px-3 py-2 whitespace-nowrap">Monto Asignado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entidad.facturas.map((f) => (
                        <tr key={f.factura_id} className="border-b border-border/30 hover:bg-secondary/20">
                          <td className="px-3 py-2 font-mono font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                              {f.numero_documento}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{f.tipo_documento}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{f.fecha_emision}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate" title={f.razon_social}>{f.razon_social}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">{clp(f.monto_bruto)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold text-primary whitespace-nowrap">{clp(f.monto_asignado)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-secondary/30 border-t border-border">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-[11px] font-bold text-foreground">TOTAL</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                          {clp(entidad.facturas.reduce((s, f) => s + f.monto_bruto, 0))}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[11px] font-bold text-primary whitespace-nowrap">
                          {clp(entidad.total_gastos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Module section — collapsible card per module
// ─────────────────────────────────────────────────────────────────────────────

function ModuloSection({ modulo, totalGlobal }: { modulo: ModuloDinamico; totalGlobal: number }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <TableIcon className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{modulo.label}</span>
          <span className="text-xs text-muted-foreground">
            {modulo.entidades.length} registro{modulo.entidades.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 text-right shrink-0">
          <div>
            <p className="text-xs font-bold text-foreground tabular-nums">{clp(modulo.total_gastos)}</p>
            <p className="text-[11px] text-muted-foreground">{pct(modulo.total_gastos, totalGlobal)} del total</p>
          </div>
        </div>
      </button>

      {/* Progress bar */}
      {totalGlobal > 0 && (
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(modulo.total_gastos / totalGlobal) * 100}%` }}
          />
        </div>
      )}

      {/* Table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: `${500 + modulo.cols_extra.length * 130}px` }}>
            <thead className="bg-secondary/20 border-b border-border">
              <tr>
                <th className="text-left font-semibold text-muted-foreground px-4 py-2 whitespace-nowrap">Registro</th>
                {modulo.cols_extra.map((col) => (
                  <th key={col} className="text-left font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {colLabel(col)}
                  </th>
                ))}
                <th className="text-center font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">Facturas</th>
                <th className="text-right font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">Gasto Asignado</th>
                <th className="text-right font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">% del módulo</th>
              </tr>
            </thead>
            <tbody>
              {modulo.entidades.map((e) => (
                <EntidadRow
                  key={`${e.modulo_label}||${e.entidad_id}`}
                  entidad={e}
                  totalModulo={modulo.total_gastos}
                  extraCols={modulo.cols_extra}
                />
              ))}
            </tbody>
            <tfoot className="bg-secondary/30 border-t-2 border-border">
              <tr>
                <td className="px-4 py-2 text-xs font-bold text-foreground">
                  TOTAL <span className="font-normal text-muted-foreground">({modulo.entidades.length})</span>
                </td>
                {modulo.cols_extra.map((col) => <td key={col} />)}
                <td className="px-3 py-2 text-center text-xs font-bold tabular-nums">
                  {modulo.entidades.reduce((s, e) => s + e.num_facturas, 0)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold tabular-nums whitespace-nowrap">
                  {clp(modulo.total_gastos)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function pctSigned(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

const ENTIDAD_TIPO_LABEL: Record<string, string> = {
  contenedor: 'Contenedor',
  producto_terminado: 'Producto terminado',
  pallet: 'Pallet',
}

function MargenKpiBar({ resumen }: { resumen: ResumenAnalisis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { icon: DollarSign, label: 'Ventas registradas', value: clp(resumen.total_ventas), accent: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        { icon: FileText, label: 'Gastos asignados', value: clp(resumen.total_gastos_asignados), accent: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
        { icon: TrendingUp, label: 'Margen total', value: clp(resumen.margen_total), accent: resumen.margen_total >= 0 ? 'text-primary' : 'text-destructive', bg: 'bg-primary/10 border-primary/20' },
        { icon: BarChart3, label: 'Margen %', value: pctSigned(resumen.margen_pct_total), accent: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/20' },
      ].map(({ icon: Icon, label, value, accent, bg }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
          <div className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${bg}`}>
            <Icon className={`w-4 h-4 ${accent}`} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">{label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 leading-tight ${accent}`}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function MargenEntidadTable({ entidades }: { entidades: AnalisisEntidad[] }) {
  const rows = entidades.filter((e) => e.total_gastos > 0 || (e.venta_total ?? 0) > 0)
  if (!rows.length) {
    return (
      <p className="text-xs text-muted-foreground py-6 text-center">
        Sin cruces gasto–venta por contenedor o producto terminado. Asigna facturas a entidades y registra kilos/ventas.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs" style={{ minWidth: '720px' }}>
        <thead className="bg-secondary/30 border-b border-border">
          <tr>
            <th className="text-left font-semibold text-muted-foreground px-4 py-2">Entidad</th>
            <th className="text-left font-semibold text-muted-foreground px-3 py-2">Tipo</th>
            <th className="text-right font-semibold text-muted-foreground px-3 py-2">Kilos</th>
            <th className="text-right font-semibold text-muted-foreground px-3 py-2">Ventas</th>
            <th className="text-right font-semibold text-muted-foreground px-3 py-2">Gastos</th>
            <th className="text-right font-semibold text-muted-foreground px-3 py-2">Costo/kg</th>
            <th className="text-right font-semibold text-muted-foreground px-3 py-2">Margen</th>
            <th className="text-right font-semibold text-muted-foreground px-3 py-2">Margen %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={`${e.entidad_tipo}-${e.entidad_id}`} className="border-b border-border/40 hover:bg-primary/3">
              <td className="px-4 py-2.5">
                <span className="font-semibold text-foreground">{e.nombre || e.entidad_id}</span>
                {e.nombre && e.nombre !== e.entidad_id && (
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">{e.entidad_id}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                {ENTIDAD_TIPO_LABEL[e.entidad_tipo] ?? e.entidad_tipo}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{e.kilos?.toLocaleString('es-CL') ?? '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{clp(e.venta_total)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{clp(e.total_gastos)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{clp(e.costo_por_kilo)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${(e.margen_real ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                {clp(e.margen_real)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{pctSigned(e.margen_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MargenSection({ clienteId }: { clienteId: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof obtenerAnalisisCostos>> | null>(null)

  useEffect(() => {
    setLoading(true)
    obtenerAnalisisCostos(clienteId)
      .then(setData)
      .finally(() => setLoading(false))
  }, [clienteId])

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Margen por contenedor / producto terminado</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Cruce de gastos asignados con kilos y ventas registradas por entidad.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : !data?.ok ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {data?.message ?? 'Error al cargar margen.'}
        </div>
      ) : (
        <>
          <MargenKpiBar resumen={data.resumen} />
          <MargenEntidadTable entidades={data.entidades} />
        </>
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

export function AnalisisCostosView({ clienteId }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData]       = useState<Awaited<ReturnType<typeof obtenerResumenCentrosCosto>> | null>(null)

  useEffect(() => {
    setLoading(true)
    obtenerResumenCentrosCosto(clienteId)
      .then(setData)
      .finally(() => setLoading(false))
  }, [clienteId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!data?.ok) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {data?.message ?? 'Error al cargar los datos.'}
      </div>
    )
  }

  const hasData = data.modulos.length > 0
  const numEntidades = data.modulos.reduce((s, m) => s + m.entidades.length, 0)

  return (
    <div className="space-y-5">
      {/* KPI summary */}
      <KpiBar
        total={data.total_gastos}
        numModulos={data.modulos.length}
        numEntidades={numEntidades}
      />

      {!hasData ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center rounded-xl border border-dashed border-border">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Sin asignaciones aún</p>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Clasifica una factura y asígnala a un centro de costo desde el panel de Clasificación.
              Los datos aparecerán aquí agrupados por módulo.
            </p>
          </div>
          {data.message && data.message.startsWith('DEBUG') && (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 max-w-lg text-left">
              <strong>Diagnóstico:</strong> {data.message.replace('DEBUG: ', '')}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {data.modulos.map((modulo) => (
            <ModuloSection
              key={modulo.label}
              modulo={modulo}
              totalGlobal={data.total_gastos}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border pt-6">
        <MargenSection clienteId={clienteId} />
      </div>
    </div>
  )
}
