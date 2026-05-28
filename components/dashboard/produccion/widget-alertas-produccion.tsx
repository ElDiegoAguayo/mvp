'use client'

import { useState } from 'react'
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Package, PackageX, TrendingDown, ShoppingCart,
  BarChart3, Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CapacidadReceta, EstadoAlerta } from '@/types/produccion'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt  = (n: number) => n.toLocaleString('es-CL')
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmt(n)

const ESTADO: Record<EstadoAlerta, { color: string; bg: string; border: string; dot: string; label: string }> = {
  critico: { color: 'text-red-300',    bg: 'bg-red-950/40',     border: 'border-red-500/50',    dot: 'bg-red-500',    label: 'Crítico'    },
  bajo:    { color: 'text-amber-300',  bg: 'bg-amber-950/25',   border: 'border-amber-500/40',  dot: 'bg-amber-500',  label: 'Stock Bajo' },
  ok:      { color: 'text-emerald-300',bg: 'bg-emerald-950/15', border: 'border-emerald-500/25',dot: 'bg-emerald-500',label: 'OK'         },
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

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

// ─── Critical Materials Panel ─────────────────────────────────────────────────
// Cross-reference: which materials limit multiple recipes → buy these first

interface CritMat {
  descripcion: string
  stock_actual: number
  unidad_medida: string
  afecta: string[]           // recipe codes affected
  max_capacidad: number      // max boxes this material allows
}

function buildCritMats(data: CapacidadReceta[]): CritMat[] {
  const map = new Map<string, CritMat>()
  for (const receta of data) {
    if (receta.estado_alerta === 'ok') continue
    const lim = receta.detalle_materiales[0]
    if (!lim) continue
    const key = lim.descripcion
    const existing = map.get(key)
    if (existing) {
      existing.afecta.push(receta.codigo_receta)
      existing.max_capacidad = Math.min(existing.max_capacidad, lim.capacidad_aportada)
    } else {
      map.set(key, {
        descripcion:   lim.descripcion,
        stock_actual:  lim.stock_actual,
        unidad_medida: lim.unidad_medida,
        afecta:        [receta.codigo_receta],
        max_capacidad: lim.capacidad_aportada,
      })
    }
  }
  // Sort by number of affected recipes desc, then by stock asc
  return [...map.values()].sort((a, b) => b.afecta.length - a.afecta.length || a.stock_actual - b.stock_actual)
}

function CriticalMaterialsPanel({ data }: { data: CapacidadReceta[] }) {
  const crits = buildCritMats(data)
  if (!crits.length) return null

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-950/10 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-red-400" />
        <h2 className="font-semibold text-sm text-red-200">Insumos que debes reponer</h2>
        <span className="ml-auto text-xs text-red-400/70">Ordenados por impacto</span>
      </div>

      <div className="space-y-2">
        {crits.map((mat) => {
          const pct = mat.stock_actual > 0 ? Math.min(100, (mat.stock_actual / Math.max(mat.stock_actual, 500)) * 100) : 0
          return (
            <div key={mat.descripcion} className="rounded-lg bg-red-900/20 border border-red-500/20 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground/90 leading-tight">{mat.descripcion}</p>
                  <p className="text-xs text-red-300/70 mt-0.5">
                    Afecta {mat.afecta.length} código{mat.afecta.length > 1 ? 's' : ''}:
                    <span className="font-mono ml-1 text-red-200">{mat.afecta.slice(0, 5).join(', ')}{mat.afecta.length > 5 ? '…' : ''}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    'text-sm font-bold',
                    mat.stock_actual === 0 ? 'text-red-400' : 'text-amber-300',
                  )}>
                    {fmt(mat.stock_actual)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{mat.unidad_medida}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">stock actual</p>
                </div>
              </div>
              {/* Stock bar */}
              <div className="h-1.5 rounded-full bg-red-900/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', mat.stock_actual === 0 ? 'bg-red-600' : 'bg-amber-500')}
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

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function RecetaCard({ receta, maxPallets }: { receta: CapacidadReceta; maxPallets: number }) {
  const [expanded, setExpanded] = useState(false)
  const est        = ESTADO[receta.estado_alerta]
  const isBad      = receta.estado_alerta !== 'ok'
  const pct        = maxPallets > 0 ? Math.min(100, (receta.capacidad_pallets / maxPallets) * 100) : 0
  const limitante  = receta.detalle_materiales[0]  // sorted asc → first = bottleneck

  return (
    <div className={cn('rounded-xl border p-4 space-y-3 transition-all', est.border, est.bg)}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
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

      {/* ── PRIMARY: how many can I produce ───────────────────────────────── */}
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
            <span className="text-muted-foreground/40 ml-1">· {receta.cajas_por_pallet} cajas/pallet</span>
          </p>
        )}
        {/* Relative progress bar */}
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

      {/* ── SECONDARY: what limits producing MORE ─────────────────────────── */}
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

      {/* ── Expandable: full material breakdown ───────────────────────────── */}
      {receta.detalle_materiales.length > 0 && (
        <>
          <button
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

// ─── Main Widget ──────────────────────────────────────────────────────────────

interface Props { data: CapacidadReceta[] }

export function WidgetAlertasProduccion({ data }: Props) {
  const [filter, setFilter] = useState<EstadoAlerta | 'todos'>('todos')

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 p-16 text-center">
        <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Sin datos de producción</p>
        <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">
          Importa el archivo Excel de Códigos de Embalaje desde el panel de administración para ver las alertas.
        </p>
      </div>
    )
  }

  const critCount = data.filter((r) => r.estado_alerta === 'critico').length
  const bajCount  = data.filter((r) => r.estado_alerta === 'bajo').length
  const okCount   = data.filter((r) => r.estado_alerta === 'ok').length
  const totalPallets = data.reduce((s, r) => s + r.capacidad_pallets, 0)
  const maxPallets   = Math.max(...data.map((r) => r.capacidad_pallets), 1)

  const filtered = filter === 'todos' ? data : data.filter((r) => r.estado_alerta === filter)

  // Group filtered by variety
  const varieties = [...new Set(data.map((r) => r.variedad ?? 'Sin variedad'))]
  const groupedFiltered = new Map<string, CapacidadReceta[]>()
  for (const r of filtered) {
    const v = r.variedad ?? 'Sin variedad'
    const list = groupedFiltered.get(v) ?? []
    list.push(r)
    groupedFiltered.set(v, list)
  }

  return (
    <div className="space-y-6">

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Pallets totales disponibles"
          value={totalPallets}
          sub="suma de todos los códigos"
          color="bg-primary/15 text-primary"
          icon={Boxes}
        />
        <KpiCard
          label="Códigos críticos"
          value={critCount}
          sub="< 10 pallets"
          color={critCount > 0 ? 'bg-red-900/40 text-red-400' : 'bg-white/5 text-muted-foreground'}
          icon={PackageX}
        />
        <KpiCard
          label="Stock bajo"
          value={bajCount}
          sub="< 50 pallets"
          color={bajCount > 0 ? 'bg-amber-900/30 text-amber-400' : 'bg-white/5 text-muted-foreground'}
          icon={TrendingDown}
        />
        <KpiCard
          label="Códigos OK"
          value={okCount}
          sub="≥ 50 pallets"
          color={okCount > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-white/5 text-muted-foreground'}
          icon={CheckCircle2}
        />
      </div>

      {/* ── Critical materials to restock ───────────────────────────────────── */}
      <CriticalMaterialsPanel data={data} />

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 w-fit">
        {(
          [
            { key: 'todos',   label: `Todos (${data.length})`,        cls: '' },
            { key: 'critico', label: `Críticos (${critCount})`,       cls: 'text-red-300'    },
            { key: 'bajo',    label: `Stock Bajo (${bajCount})`,      cls: 'text-amber-300'  },
            { key: 'ok',      label: `OK (${okCount})`,               cls: 'text-emerald-300'},
          ] as const
        ).map(({ key, label, cls }) => (
          <button
            key={key}
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

      {/* ── Cards by variety ────────────────────────────────────────────────── */}
      {varieties.map((variety) => {
        const cards = groupedFiltered.get(variety)
        if (!cards?.length) return null
        const vCrit = cards.filter((c) => c.estado_alerta === 'critico').length
        const vBaj  = cards.filter((c) => c.estado_alerta === 'bajo').length
        return (
          <section key={variety} className="space-y-3">
            {/* Variety header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary/70" />
                <h3 className="text-sm font-semibold text-foreground">{variety}</h3>
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
              <div className="h-px flex-1 bg-border/30" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {cards.map((receta) => (
                <RecetaCard key={receta.codigo_receta} receta={receta} maxPallets={maxPallets} />
              ))}
            </div>
          </section>
        )
      })}

      <p className="text-[10px] text-muted-foreground/40 text-center">
        Crítico &lt; 10 pallets · Bajo &lt; 50 pallets · OK ≥ 50 pallets
      </p>
    </div>
  )
}
