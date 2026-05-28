'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle2, ChevronDown, ChevronUp,
  Package, PackageX, TrendingDown, ShoppingCart,
  BarChart3, Boxes, Search, Download, Calculator,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { CapacidadReceta, EstadoAlerta } from '@/types/produccion'
import { toast } from 'sonner'
import { usePagination } from '@/hooks/use-pagination'
import { TablePaginationBar } from '@/components/ui/table-pagination-bar'
import { exportListaCompraExcel } from '@/lib/produccion/export-lista-compra-xlsx'
import {
  UMBRAL_CRITICO_PALLETS,
  UMBRAL_BAJO_PALLETS,
  UMBRAL_OK_PALLETS,
  PALLETS_STEP,
  redondearUnidadesArriba,
} from '@/lib/produccion/constants'

const PAGE_SIZE = 10

const fmt  = (n: number) => n.toLocaleString('es-CL')
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmt(n)

const ESTADO: Record<EstadoAlerta, { color: string; bg: string; border: string; dot: string; label: string }> = {
  critico: { color: 'text-red-300',    bg: 'bg-red-950/40',     border: 'border-red-500/50',    dot: 'bg-red-500',    label: 'Crítico'    },
  bajo:    { color: 'text-amber-300',  bg: 'bg-amber-950/25',   border: 'border-amber-500/40',  dot: 'bg-amber-500',  label: 'Stock Bajo' },
  ok:      { color: 'text-emerald-300',bg: 'bg-emerald-950/15', border: 'border-emerald-500/25',dot: 'bg-emerald-500',label: 'OK'         },
}

function KpiCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string | number; sub?: string
  color: string; icon: React.ElementType
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-foreground leading-none">{typeof value === 'number' ? fmt(value) : value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

interface CritMat {
  descripcion: string
  stock_actual: number
  unidad_medida: string
  afecta: string[]
  max_capacidad: number
  sugerido_comprar: number
  necesario_por_caja: number
}

function buildCritMats(data: CapacidadReceta[]): CritMat[] {
  const map = new Map<string, CritMat>()

  for (const receta of data) {
    if (receta.estado_alerta === 'ok') continue
    const lim = receta.detalle_materiales[0]
    if (!lim) continue

    const cajasXPallet = receta.cajas_por_pallet ?? 1
    const targetCajas = UMBRAL_OK_PALLETS * cajasXPallet
    const faltanCajas = Math.max(0, targetCajas - receta.capacidad_maxima)
    const unidadesNecesarias = redondearUnidadesArriba(faltanCajas * lim.necesario_por_caja)

    const key = lim.descripcion
    const existing = map.get(key)
    if (existing) {
      existing.afecta.push(receta.codigo_receta)
      existing.max_capacidad = Math.min(existing.max_capacidad, lim.capacidad_aportada)
      existing.sugerido_comprar = Math.max(existing.sugerido_comprar, unidadesNecesarias)
    } else {
      map.set(key, {
        descripcion: lim.descripcion,
        stock_actual: lim.stock_actual,
        unidad_medida: lim.unidad_medida,
        afecta: [receta.codigo_receta],
        max_capacidad: lim.capacidad_aportada,
        sugerido_comprar: unidadesNecesarias,
        necesario_por_caja: lim.necesario_por_caja,
      })
    }
  }

  return [...map.values()].sort(
    (a, b) => b.afecta.length - a.afecta.length || a.stock_actual - b.stock_actual,
  )
}

function CriticalMaterialsPanel({
  data,
  onHighlight,
  highlightCodigos,
}: {
  data: CapacidadReceta[]
  onHighlight: (codigos: string[]) => void
  highlightCodigos: string[]
}) {
  const crits = buildCritMats(data)
  const [expandedMat, setExpandedMat] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  if (!crits.length) return null

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportListaCompraExcel(crits)
      toast.success('Lista de compra exportada en Excel')
    } catch {
      toast.error('No se pudo exportar la lista de compra')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-950/10 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <ShoppingCart className="w-4 h-4 text-red-400" />
          <h2 className="font-semibold text-sm text-red-200">Insumos que debes reponer</h2>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5 shrink-0"
          disabled={exporting}
          onClick={handleExport}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Generando…' : 'Exportar Excel'}
        </Button>
      </div>

      <div className="space-y-2">
        {crits.map((mat, idx) => {
          const barMax = Math.max(mat.sugerido_comprar + mat.stock_actual, mat.stock_actual, 1)
          const pct = Math.min(100, (mat.stock_actual / barMax) * 100)
          const isExpanded = expandedMat === mat.descripcion
          const isHighlighted = mat.afecta.some((c) => highlightCodigos.includes(c))

          return (
            <div
              key={mat.descripcion}
              className={cn(
                'rounded-lg bg-red-900/20 border px-3 py-2.5 transition-all',
                isHighlighted ? 'border-primary/50 ring-1 ring-primary/30' : 'border-red-500/20',
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600/50 text-white">
                      #{idx + 1}
                    </span>
                    <p className="text-sm font-semibold text-foreground/90 leading-tight">{mat.descripcion}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedMat(isExpanded ? null : mat.descripcion)
                      onHighlight(mat.afecta)
                    }}
                    className="text-xs text-red-300/80 mt-1 hover:text-red-200 text-left"
                  >
                    Afecta {mat.afecta.length} código{mat.afecta.length > 1 ? 's' : ''} —{' '}
                    {isExpanded ? 'ocultar' : 'ver todos'}
                  </button>
                  {isExpanded && (
                    <p className="text-xs font-mono text-red-200/90 mt-1 leading-relaxed">
                      {mat.afecta.join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div>
                    <p className={cn('text-sm font-bold', mat.stock_actual === 0 ? 'text-red-400' : 'text-amber-300')}>
                      {fmt(mat.stock_actual)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{mat.unidad_medida}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">stock actual</p>
                  </div>
                  {mat.sugerido_comprar > 0 && (
                    <div>
                      <p className="text-sm font-bold text-emerald-400">
                        +{fmt(Math.ceil(mat.sugerido_comprar))}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">sugerido comprar</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-red-900/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', mat.stock_actual === 0 ? 'bg-red-600' : 'bg-amber-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SimuladorCompra({ data, crits }: { data: CapacidadReceta[]; crits: CritMat[] }) {
  const [material, setMaterial] = useState(crits[0]?.descripcion ?? '')
  const [cantidad, setCantidad] = useState('')

  const resultados = useMemo(() => {
    const qty = Number(cantidad.replace(',', '.'))
    if (!material || !Number.isFinite(qty) || qty <= 0) return []

    return data
      .filter((r) => r.estado_alerta !== 'ok')
      .map((receta) => {
        const mat = receta.detalle_materiales.find((m) => m.descripcion === material)
        if (!mat || mat.necesario_por_caja <= 0) return null
        const cajasExtra = Math.floor(qty / mat.necesario_por_caja)
        if (cajasExtra <= 0) return null
        return {
          codigo: receta.codigo_receta,
          cajasActuales: receta.capacidad_maxima,
          cajasNuevas: receta.capacidad_maxima + cajasExtra,
          cajasExtra,
        }
      })
      .filter(Boolean) as { codigo: string; cajasActuales: number; cajasNuevas: number; cajasExtra: number }[]
  }, [cantidad, data, material])

  if (!crits.length) return null

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Simulador de compra</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Estima cuántas cajas adicionales podrías armar si compras un insumo.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          {crits.map((c) => (
            <option key={c.descripcion} value={c.descripcion}>{c.descripcion}</option>
          ))}
        </select>
        <Input
          type="number"
          min={0}
          placeholder="Cantidad a comprar"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="sm:w-44 h-9"
        />
      </div>
      {resultados.length > 0 && (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Código</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Hoy</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Con compra</th>
                <th className="text-right px-3 py-2 font-medium text-emerald-500">+Cajas</th>
              </tr>
            </thead>
            <tbody>
              {resultados.slice(0, 12).map((r) => (
                <tr key={r.codigo} className="border-t border-border/30">
                  <td className="px-3 py-2 font-mono">{r.codigo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.cajasActuales)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(r.cajasNuevas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-400">+{fmt(r.cajasExtra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {resultados.length > 12 && (
            <p className="text-[10px] text-muted-foreground px-3 py-2">
              y {resultados.length - 12} códigos más…
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function RecetaCard({
  receta,
  maxPallets,
  highlighted,
}: {
  receta: CapacidadReceta
  maxPallets: number
  highlighted?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const est = ESTADO[receta.estado_alerta]
  const isBad = receta.estado_alerta !== 'ok'
  const pct = maxPallets > 0 ? Math.min(100, (receta.capacidad_pallets / maxPallets) * 100) : 0
  const limitante = receta.detalle_materiales[0]

  return (
    <div
      id={`receta-${receta.codigo_receta}`}
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all',
        est.border, est.bg,
        highlighted && 'ring-2 ring-primary/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', est.dot)} />
          <div className="min-w-0">
            <p className="font-bold text-sm font-mono leading-none">{receta.codigo_receta}</p>
            {receta.variedad && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{receta.variedad}</p>
            )}
          </div>
        </div>
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0',
          receta.estado_alerta === 'critico' ? 'bg-red-600/70 text-white' :
          receta.estado_alerta === 'bajo'    ? 'bg-amber-500/70 text-black' :
                                               'bg-emerald-600/70 text-white',
        )}>
          {est.label}
        </span>
      </div>

      <div className="rounded-lg bg-white/5 px-3 py-2.5">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5 font-medium">
          Puedes armar
        </p>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-4xl font-black leading-none tracking-tight', est.color)}>
            {fmt(receta.capacidad_maxima)}
          </span>
          <span className="text-base font-semibold text-muted-foreground">cajas</span>
        </div>
        {receta.cajas_por_pallet && (
          <p className="text-xs text-muted-foreground/60 mt-1">
            <span className={cn('font-semibold', est.color)}>{fmt(receta.capacidad_pallets)}</span>
            {' pallets completos'}
            <span className="text-muted-foreground/40 ml-1">· bloques de {PALLETS_STEP}</span>
            <span className="text-muted-foreground/40 ml-1">· {receta.cajas_por_pallet} cajas/pallet</span>
          </p>
        )}
        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              receta.estado_alerta === 'critico' ? 'bg-red-500' :
              receta.estado_alerta === 'bajo'    ? 'bg-amber-500' :
                                                   'bg-emerald-500',
            )}
            style={{ width: `${Math.max(pct, receta.capacidad_maxima > 0 ? 3 : 0)}%` }}
          />
        </div>
      </div>

      {isBad && limitante && (
        <div className={cn(
          'rounded-lg px-3 py-2.5 border space-y-1',
          receta.estado_alerta === 'critico'
            ? 'bg-red-900/30 border-red-500/25'
            : 'bg-amber-900/20 border-amber-500/20',
        )}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            Para producir más, necesitas
          </p>
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-xs font-semibold leading-tight',
              receta.estado_alerta === 'critico' ? 'text-red-200' : 'text-amber-200',
            )}>
              {limitante.descripcion}
            </p>
            <div className="text-right shrink-0">
              <p className={cn(
                'text-xs font-bold font-mono',
                limitante.stock_actual === 0 ? 'text-red-400' : 'text-amber-300',
              )}>
                {limitante.stock_actual === 0 ? 'Sin stock' : `${fmt(limitante.stock_actual)} uds.`}
              </p>
              <p className="text-[10px] text-muted-foreground/50">stock actual</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            Necesitas {limitante.necesario_por_caja} unidad{limitante.necesario_por_caja > 1 ? 'es' : ''} por caja
          </p>
        </div>
      )}

      {receta.detalle_materiales.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full pt-1 border-t border-white/5"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Ocultar' : 'Ver desglose de'} materiales ({receta.detalle_materiales.length})
          </button>

          {expanded && (
            <div className="rounded-lg overflow-hidden border border-white/5">
              <table className="w-full text-xs">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-muted-foreground/70 font-medium">Material</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground/70 font-medium">Stock</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground/70 font-medium">×caja</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground/70 font-medium">Alcanza para</th>
                  </tr>
                </thead>
                <tbody>
                  {receta.detalle_materiales.map((mat, i) => {
                    const isBot = i === 0 && isBad
                    return (
                      <tr key={mat.codigo} className={cn('border-t border-white/5', isBot ? 'bg-red-900/20' : 'hover:bg-white/[0.02]')}>
                        <td className="px-2 py-1.5 text-foreground/80 max-w-[150px]">
                          <div className="flex items-center gap-1.5">
                            {isBot && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />}
                            <span className="truncate">{mat.descripcion}</span>
                          </div>
                        </td>
                        <td className={cn('px-2 py-1.5 text-right font-mono', mat.stock_actual === 0 ? 'text-red-400 font-bold' : 'text-muted-foreground')}>
                          {mat.stock_actual === 0 ? '0 ⚠' : fmtK(mat.stock_actual)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">{mat.necesario_por_caja}</td>
                        <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', isBot ? 'text-red-300' : 'text-foreground/60')}>
                          {mat.capacidad_aportada >= 999999 ? '∞' : `${fmtK(mat.capacidad_aportada)} cajas`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function VarietySection({
  variety,
  cards,
  maxPallets,
  highlightCodigos,
  defaultCollapsed,
}: {
  variety: string
  cards: CapacidadReceta[]
  maxPallets: number
  highlightCodigos: string[]
  defaultCollapsed: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const vCrit = cards.filter((c) => c.estado_alerta === 'critico').length
  const vBaj = cards.filter((c) => c.estado_alerta === 'bajo').length

  const {
    page,
    setPage,
    totalPages,
    totalItems,
    paginatedItems,
    startIndex,
    endIndex,
    hasPagination,
  } = usePagination(cards, PAGE_SIZE)

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-3 w-full text-left group"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          <BarChart3 className="w-4 h-4 text-primary/70" />
          <h3 className="text-sm font-semibold text-foreground">{variety}</h3>
          <span className="text-xs text-muted-foreground">({cards.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          {vCrit > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 font-medium">
              {vCrit} crítico{vCrit > 1 ? 's' : ''}
            </span>
          )}
          {vBaj > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 font-medium">
              {vBaj} bajo{vBaj > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="h-px flex-1 bg-border/30 group-hover:bg-border/50 transition-colors" />
      </button>

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedItems.map((receta) => (
              <RecetaCard
                key={receta.codigo_receta}
                receta={receta}
                maxPallets={maxPallets}
                highlighted={highlightCodigos.includes(receta.codigo_receta)}
              />
            ))}
          </div>
          {hasPagination && (
            <TablePaginationBar
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={setPage}
              itemLabel="códigos"
            />
          )}
        </>
      )}
    </section>
  )
}

interface Props {
  data: CapacidadReceta[]
  updatedAt?: string | null
}

export function WidgetAlertasProduccion({ data, updatedAt }: Props) {
  const [filter, setFilter] = useState<EstadoAlerta | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [highlightCodigos, setHighlightCodigos] = useState<string[]>([])

  const crits = useMemo(() => buildCritMats(data), [data])

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 p-16 text-center">
        <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Sin datos de producción</p>
        <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">
          Importa el archivo Excel de Códigos de Embalaje desde Admin → Clientes para ver las alertas.
        </p>
      </div>
    )
  }

  const critCount = data.filter((r) => r.estado_alerta === 'critico').length
  const bajCount  = data.filter((r) => r.estado_alerta === 'bajo').length
  const okCount   = data.filter((r) => r.estado_alerta === 'ok').length
  const totalPallets = data.reduce((s, r) => s + r.capacidad_pallets, 0)
  const maxPallets   = Math.max(...data.map((r) => r.capacidad_pallets), 1)

  const q = search.trim().toLowerCase()
  const filtered = (filter === 'todos' ? data : data.filter((r) => r.estado_alerta === filter))
    .filter((r) =>
      !q ||
      r.codigo_receta.toLowerCase().includes(q) ||
      (r.variedad ?? '').toLowerCase().includes(q) ||
      r.detalle_materiales.some((m) => m.descripcion.toLowerCase().includes(q)),
    )

  const varieties = [...new Set(filtered.map((r) => r.variedad ?? 'Sin variedad'))]
  const groupedFiltered = new Map<string, CapacidadReceta[]>()
  for (const r of filtered) {
    const v = r.variedad ?? 'Sin variedad'
    const list = groupedFiltered.get(v) ?? []
    list.push(r)
    groupedFiltered.set(v, list)
  }

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className="space-y-6">
      {updatedLabel && (
        <p className="text-xs text-muted-foreground">
          Inventario actualizado: <span className="font-medium text-foreground">{updatedLabel}</span>
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Pallets totales disponibles" value={totalPallets} sub="suma de todos los códigos" color="bg-primary/15 text-primary" icon={Boxes} />
        <KpiCard label="Códigos críticos" value={critCount} sub={`< ${UMBRAL_CRITICO_PALLETS} pallets`} color={critCount > 0 ? 'bg-red-900/40 text-red-400' : 'bg-white/5 text-muted-foreground'} icon={PackageX} />
        <KpiCard label="Stock bajo" value={bajCount} sub={`< ${UMBRAL_BAJO_PALLETS} pallets`} color={bajCount > 0 ? 'bg-amber-900/30 text-amber-400' : 'bg-white/5 text-muted-foreground'} icon={TrendingDown} />
        <KpiCard label="Códigos OK" value={okCount} sub={`≥ ${UMBRAL_OK_PALLETS} pallets`} color={okCount > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-white/5 text-muted-foreground'} icon={CheckCircle2} />
      </div>

      <CriticalMaterialsPanel
        data={data}
        onHighlight={(codigos) => {
          setHighlightCodigos(codigos)
          setSearch('')
          setTimeout(() => {
            document.getElementById(`receta-${codigos[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
        }}
        highlightCodigos={highlightCodigos}
      />

      <SimuladorCompra data={data} crits={crits} />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 w-fit flex-wrap">
          {(
            [
              { key: 'todos',   label: `Todos (${data.length})`,   cls: '' },
              { key: 'critico', label: `Críticos (${critCount})`,  cls: 'text-red-300'    },
              { key: 'bajo',    label: `Stock Bajo (${bajCount})`, cls: 'text-amber-300'  },
              { key: 'ok',      label: `OK (${okCount})`,          cls: 'text-emerald-300'},
            ] as const
          ).map(({ key, label, cls }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key as EstadoAlerta | 'todos')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filter === key
                  ? 'bg-white/15 text-foreground shadow-sm'
                  : cn('text-muted-foreground hover:text-foreground', cls),
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar código, variedad o material…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Ningún código coincide con la búsqueda o filtro.
        </div>
      ) : (
        varieties.map((variety) => {
          const cards = groupedFiltered.get(variety)
          if (!cards?.length) return null
          const onlyOk = cards.every((c) => c.estado_alerta === 'ok')
          return (
            <VarietySection
              key={variety}
              variety={variety}
              cards={cards}
              maxPallets={maxPallets}
              highlightCodigos={highlightCodigos}
              defaultCollapsed={onlyOk && cards.length > 4}
            />
          )
        })
      )}

      <p className="text-[10px] text-muted-foreground/40 text-center">
        Capacidad en pallets redondeada hacia abajo en bloques de {PALLETS_STEP} · Crítico &lt; {UMBRAL_CRITICO_PALLETS} · Bajo &lt; {UMBRAL_BAJO_PALLETS} · OK ≥ {UMBRAL_OK_PALLETS} · Compra sugerida en múltiplos de 5
      </p>
    </div>
  )
}
