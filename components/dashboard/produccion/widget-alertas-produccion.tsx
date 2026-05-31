'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  CheckCircle2, ChevronDown, ChevronUp,
  Package, PackageX, TrendingDown, ShoppingCart,
  BarChart3, Boxes, Search, Download, Calculator, List, Maximize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { CapacidadReceta, EstadoAlerta } from '@/types/produccion'
import { toast } from 'sonner'
import { usePagination } from '@/hooks/use-pagination'
import { TablePaginationBar } from '@/components/ui/table-pagination-bar'
import { exportListaCompraExcel } from '@/lib/produccion/export-lista-compra-xlsx'
import { useLocale } from '@/components/i18n/locale-provider'
import { localeToBcp47 } from '@/lib/i18n/config'
import {
  UMBRAL_CRITICO_PALLETS,
  UMBRAL_BAJO_PALLETS,
  UMBRAL_OK_PALLETS,
  PALLETS_STEP,
  redondearUnidadesArriba,
} from '@/lib/produccion/constants'

const PAGE_SIZE = 10
const CRIT_MATS_PAGE_SIZE = 5

function createNumberFormatters(locale: 'es' | 'en') {
  const tag = localeToBcp47(locale)
  const fmt = (n: number) => n.toLocaleString(tag)
  const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmt(n))
  return { fmt, fmtK }
}

type MaterialCatalogRow = {
  key: string
  codigo: string
  descripcion: string
  stock_actual: number
  unidad_medida: string
  necesario_por_caja: number
  codigos_embalaje: string[]
}

function buildMaterialsCatalog(data: CapacidadReceta[], locale: 'es' | 'en'): MaterialCatalogRow[] {
  const map = new Map<string, MaterialCatalogRow>()

  for (const receta of data) {
    for (const mat of receta.detalle_materiales) {
      const key = mat.codigo || mat.descripcion
      const existing = map.get(key)
      if (existing) {
        if (!existing.codigos_embalaje.includes(receta.codigo_receta)) {
          existing.codigos_embalaje.push(receta.codigo_receta)
        }
        existing.stock_actual = mat.stock_actual
        existing.necesario_por_caja = mat.necesario_por_caja
      } else {
        map.set(key, {
          key,
          codigo: mat.codigo,
          descripcion: mat.descripcion,
          stock_actual: mat.stock_actual,
          unidad_medida: mat.unidad_medida,
          necesario_por_caja: mat.necesario_por_caja,
          codigos_embalaje: [receta.codigo_receta],
        })
      }
    }
  }

  return [...map.values()].sort((a, b) => a.descripcion.localeCompare(b.descripcion, localeToBcp47(locale)))
}

function AllMaterialsDialog({
  open,
  onOpenChange,
  materials,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  materials: MaterialCatalogRow[]
}) {
  const { t, locale } = useLocale()
  const { fmt } = createNumberFormatters(locale)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return materials
    return materials.filter((m) =>
      m.descripcion.toLowerCase().includes(q)
      || m.codigo.toLowerCase().includes(q)
      || m.codigos_embalaje.some((c) => c.toLowerCase().includes(q)),
    )
  }, [materials, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('produccion.materialsDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('produccion.materialsDialog.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <p className="text-xs text-muted-foreground shrink-0">
          {t('produccion.materialsDialog.count', { filtered: filtered.length, total: materials.length })}
        </p>
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-3 py-2.5 font-medium text-muted-foreground min-w-[240px]">{t('produccion.materialsDialog.columns.material')}</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">{t('produccion.materialsDialog.columns.stock')}</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground text-right">{t('produccion.materialsDialog.columns.perBox')}</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground min-w-[140px]">{t('produccion.materialsDialog.columns.packagingCodes')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground text-sm">
                    {t('produccion.materialsDialog.noResults')}
                  </td>
                </tr>
              ) : filtered.map((mat) => (
                <tr key={mat.key} className="border-t border-border align-top hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <p className="font-medium leading-snug break-words text-foreground">{mat.descripcion}</p>
                    {mat.codigo && (
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{mat.codigo}</p>
                    )}
                  </td>
                  <td className={cn(
                    'px-3 py-2.5 tabular-nums whitespace-nowrap',
                    mat.stock_actual === 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-foreground',
                  )}>
                    {mat.stock_actual === 0 ? t('produccion.stock.none') : `${fmt(mat.stock_actual)} ${mat.unidad_medida}`}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {mat.necesario_por_caja}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-mono leading-relaxed break-words text-muted-foreground">
                      {mat.codigos_embalaje.join(', ')}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const ESTADO: Record<EstadoAlerta, {
  metric: string
  bg: string
  border: string
  dot: string
  panel: string
  panelBorder: string
  limitanteBg: string
  limitanteBorder: string
  limitanteTitle: string
  limitanteMat: string
  progressTrack: string
}> = {
  critico: {
    metric: 'text-red-600 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-500/50',
    dot: 'bg-red-500',
    panel: 'bg-white dark:bg-white/5',
    panelBorder: 'border-red-100 dark:border-transparent',
    limitanteBg: 'bg-red-100/90 dark:bg-red-900/30',
    limitanteBorder: 'border-red-200 dark:border-red-500/25',
    limitanteTitle: 'text-red-700/80 dark:text-muted-foreground/60',
    limitanteMat: 'text-red-900 dark:text-red-200',
    progressTrack: 'bg-red-100 dark:bg-white/5',
  },
  bajo: {
    metric: 'text-amber-600 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/25',
    border: 'border-amber-200 dark:border-amber-500/40',
    dot: 'bg-amber-500',
    panel: 'bg-white dark:bg-white/5',
    panelBorder: 'border-amber-100 dark:border-transparent',
    limitanteBg: 'bg-amber-100/90 dark:bg-amber-900/20',
    limitanteBorder: 'border-amber-200 dark:border-amber-500/20',
    limitanteTitle: 'text-amber-800/80 dark:text-muted-foreground/60',
    limitanteMat: 'text-amber-900 dark:text-amber-200',
    progressTrack: 'bg-amber-100 dark:bg-white/5',
  },
  ok: {
    metric: 'text-emerald-600 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/15',
    border: 'border-emerald-200 dark:border-emerald-500/25',
    dot: 'bg-emerald-500',
    panel: 'bg-white dark:bg-white/5',
    panelBorder: 'border-emerald-100 dark:border-transparent',
    limitanteBg: 'bg-muted dark:bg-emerald-900/20',
    limitanteBorder: 'border-border dark:border-emerald-500/20',
    limitanteTitle: 'text-muted-foreground',
    limitanteMat: 'text-foreground',
    progressTrack: 'bg-emerald-100 dark:bg-white/5',
  },
}

function KpiCard({
  label, value, sub, color, icon: Icon, fmt,
}: {
  label: string; value: string | number; sub?: string
  color: string; icon: React.ElementType
  fmt: (n: number) => string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 shadow-sm">
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
  const { t, locale } = useLocale()
  const { fmt } = createNumberFormatters(locale)
  const crits = buildCritMats(data)
  const [expandedMat, setExpandedMat] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const {
    page,
    setPage,
    totalPages,
    totalItems,
    paginatedItems,
    startIndex,
    endIndex,
    hasPagination,
  } = usePagination(crits, CRIT_MATS_PAGE_SIZE)

  if (!crits.length) return null

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportListaCompraExcel(crits)
      toast.success(t('produccion.criticalMaterials.exportSuccess'))
    } catch {
      toast.error(t('produccion.criticalMaterials.exportError'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/80 dark:bg-red-950/10 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <ShoppingCart className="w-4 h-4 text-red-600 dark:text-red-400" />
          <h2 className="font-semibold text-sm text-red-900 dark:text-red-200">{t('produccion.criticalMaterials.title')}</h2>
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
          {exporting ? t('produccion.export.generating') : t('produccion.export.button')}
        </Button>
      </div>

      <div className="space-y-2">
        {paginatedItems.map((mat, idx) => {
          const barMax = Math.max(mat.sugerido_comprar + mat.stock_actual, mat.stock_actual, 1)
          const pct = Math.min(100, (mat.stock_actual / barMax) * 100)
          const isExpanded = expandedMat === mat.descripcion
          const isHighlighted = mat.afecta.some((c) => highlightCodigos.includes(c))
          const rank = startIndex + idx + 1

          return (
            <div
              key={mat.descripcion}
              className={cn(
                'rounded-lg bg-white dark:bg-red-900/20 border px-3 py-2.5 transition-all shadow-sm',
                isHighlighted ? 'border-primary ring-1 ring-primary/30' : 'border-red-200 dark:border-red-500/20',
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0">
                      #{rank}
                    </span>
                    <p className="text-sm font-semibold text-foreground/90 leading-tight line-clamp-2 min-w-0">
                      {mat.descripcion}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedMat(isExpanded ? null : mat.descripcion)
                      onHighlight(mat.afecta)
                    }}
                    className="text-xs text-red-700 dark:text-red-300/80 mt-1 hover:text-red-800 dark:hover:text-red-200 text-left"
                  >
                    {isExpanded
                      ? t('produccion.criticalMaterials.affectsHide', { count: mat.afecta.length })
                      : t('produccion.criticalMaterials.affectsShow', { count: mat.afecta.length })}
                  </button>
                  {isExpanded && (
                    <p className="text-xs font-mono text-red-800 dark:text-red-200/90 mt-1 leading-relaxed">
                      {mat.afecta.join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div>
                    <p className={cn('text-sm font-bold', mat.stock_actual === 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300')}>
                      {fmt(mat.stock_actual)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{mat.unidad_medida}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">{t('produccion.stock.current')}</p>
                  </div>
                  {mat.sugerido_comprar > 0 && (
                    <div>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        +{fmt(Math.ceil(mat.sugerido_comprar))}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">{t('produccion.stock.suggestedPurchase')}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-red-100 dark:bg-red-900/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', mat.stock_actual === 0 ? 'bg-red-600' : 'bg-amber-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {hasPagination && (
        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          itemLabel={t('produccion.pagination.supplies')}
          className="rounded-lg border border-red-200 dark:border-red-500/20 bg-white dark:bg-red-950/20 border-t-red-200 dark:border-t-red-500/20"
        />
      )}
    </div>
  )
}

function SimuladorCompra({ data, crits }: { data: CapacidadReceta[]; crits: CritMat[] }) {
  const { t, locale } = useLocale()
  const { fmt } = createNumberFormatters(locale)
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
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{t('produccion.simulator.title')}</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('produccion.simulator.description')}
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
          placeholder={t('produccion.simulator.quantityPlaceholder')}
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
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('produccion.simulator.columns.code')}</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">{t('produccion.simulator.columns.today')}</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">{t('produccion.simulator.columns.withPurchase')}</th>
                <th className="text-right px-3 py-2 font-medium text-emerald-500">{t('produccion.simulator.columns.extraBoxes')}</th>
              </tr>
            </thead>
            <tbody>
              {resultados.slice(0, 12).map((r) => (
                <tr key={r.codigo} className="border-t border-border/30">
                  <td className="px-3 py-2 font-mono">{r.codigo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.cajasActuales)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(r.cajasNuevas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">+{fmt(r.cajasExtra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {resultados.length > 12 && (
            <p className="text-[10px] text-muted-foreground px-3 py-2">
              {t('produccion.simulator.moreCodes', { count: resultados.length - 12 })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function RecetaMaterialsDialog({
  open,
  onOpenChange,
  receta,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  receta: CapacidadReceta
}) {
  const { t, locale } = useLocale()
  const { fmt } = createNumberFormatters(locale)
  const [query, setQuery] = useState('')
  const isBad = receta.estado_alerta !== 'ok'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return receta.detalle_materiales
    return receta.detalle_materiales.filter((m) =>
      m.descripcion.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q),
    )
  }, [receta.detalle_materiales, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="space-y-1">
            <span>{t('produccion.recipeMaterialsDialog.title', { code: receta.codigo_receta })}</span>
            {(receta.variedad || receta.descripcion) && (
              <span className="block text-sm font-normal text-muted-foreground">
                {[receta.variedad, receta.descripcion].filter(Boolean).join(' · ')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('produccion.recipeMaterialsDialog.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <p className="text-xs text-muted-foreground shrink-0">
          {t('produccion.recipeMaterialsDialog.count', {
            filtered: filtered.length,
            total: receta.detalle_materiales.length,
          })}
          {' · '}
          {t('produccion.recipeMaterialsDialog.canAssemble', { count: fmt(receta.capacidad_maxima) })}
        </p>
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-3 py-2.5 font-medium text-muted-foreground min-w-[280px]">{t('produccion.materialsDialog.columns.material')}</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">{t('produccion.materialsDialog.columns.stock')}</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground text-right">{t('produccion.materialsDialog.columns.perBox')}</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground text-right">{t('produccion.recipeMaterialsDialog.columns.reachesFor')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground text-sm">
                    {t('produccion.materialsDialog.noResults')}
                  </td>
                </tr>
              ) : filtered.map((mat) => {
                const origIdx = receta.detalle_materiales.indexOf(mat)
                const isBot = origIdx === 0 && isBad
                return (
                  <tr
                    key={`${mat.codigo}-${origIdx}`}
                    className={cn(
                      'border-t border-border align-top',
                      isBot ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-muted/30',
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        {isBot && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />}
                        <div className="min-w-0">
                          <p className="font-medium leading-snug break-words text-foreground">{mat.descripcion}</p>
                          {mat.codigo && (
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">{mat.codigo}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={cn(
                      'px-3 py-2.5 tabular-nums whitespace-nowrap',
                      mat.stock_actual === 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-foreground',
                    )}>
                      {mat.stock_actual === 0 ? t('produccion.stock.none') : `${fmt(mat.stock_actual)} ${mat.unidad_medida}`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {mat.necesario_por_caja}
                    </td>
                    <td className={cn(
                      'px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap',
                      isBot ? 'text-red-700 dark:text-red-300' : 'text-foreground',
                    )}>
                      {mat.capacidad_aportada >= 999999 ? '∞' : t('produccion.boxes.count', { count: fmt(mat.capacidad_aportada) })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecetaCard({
  receta,
  maxPallets,
  highlighted,
  materialsExpanded,
  onToggleMaterials,
}: {
  receta: CapacidadReceta
  maxPallets: number
  highlighted?: boolean
  materialsExpanded: boolean
  onToggleMaterials: () => void
}) {
  const { t, locale } = useLocale()
  const { fmt, fmtK } = createNumberFormatters(locale)
  const [materialsDialogOpen, setMaterialsDialogOpen] = useState(false)
  const est = ESTADO[receta.estado_alerta]
  const isBad = receta.estado_alerta !== 'ok'
  const pct = maxPallets > 0 ? Math.min(100, (receta.capacidad_pallets / maxPallets) * 100) : 0
  const limitante = receta.detalle_materiales[0]

  return (
    <div
      id={`receta-${receta.codigo_receta}`}
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all shadow-sm self-start w-full overflow-hidden',
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
          receta.estado_alerta === 'critico' ? 'bg-red-600 text-white' :
          receta.estado_alerta === 'bajo'    ? 'bg-amber-500 text-white' :
                                               'bg-emerald-600 text-white',
        )}>
          {t(`produccion.status.${receta.estado_alerta}`)}
        </span>
      </div>

      <div className={cn('rounded-lg border px-3 py-2.5', est.panel, est.panelBorder)}>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 font-medium">
          {t('produccion.recipeCard.canAssemble')}
        </p>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-4xl font-black leading-none tracking-tight', est.metric)}>
            {fmt(receta.capacidad_maxima)}
          </span>
          <span className="text-base font-semibold text-muted-foreground">{t('produccion.recipeCard.boxes')}</span>
        </div>
        {receta.cajas_por_pallet && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className={cn('font-semibold', est.metric)}>{fmt(receta.capacidad_pallets)}</span>
            {' '}{t('produccion.recipeCard.completePallets')}
            <span className="text-muted-foreground/70 ml-1">{t('produccion.recipeCard.blocksOf', { step: PALLETS_STEP })}</span>
            <span className="text-muted-foreground/70 ml-1">{t('produccion.recipeCard.boxesPerPallet', { count: receta.cajas_por_pallet })}</span>
          </p>
        )}
        <div className={cn('mt-2 h-1.5 rounded-full overflow-hidden', est.progressTrack)}>
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
          est.limitanteBg,
          est.limitanteBorder,
        )}>
          <p className={cn('text-[10px] font-semibold uppercase tracking-wide', est.limitanteTitle)}>
            {t('produccion.recipeCard.needMoreTitle')}
          </p>
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-xs font-semibold leading-tight line-clamp-2 min-w-0 flex-1', est.limitanteMat)}>
              {limitante.descripcion}
            </p>
            <div className="text-right shrink-0">
              <p className={cn(
                'text-xs font-bold font-mono',
                limitante.stock_actual === 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300',
              )}>
                {limitante.stock_actual === 0 ? t('produccion.stock.none') : `${fmt(limitante.stock_actual)} ${t('produccion.units.abbrev')}`}
              </p>
              <p className="text-[10px] text-muted-foreground">{t('produccion.stock.current')}</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t('produccion.recipeCard.unitsPerBox', { count: limitante.necesario_por_caja })}
          </p>
        </div>
      )}

      {receta.detalle_materiales.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <button
              type="button"
              onClick={onToggleMaterials}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1"
            >
              {materialsExpanded ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
              <span className="truncate">
                {materialsExpanded
                  ? t('produccion.recipeCard.hideMaterials', { count: receta.detalle_materiales.length })
                  : t('produccion.recipeCard.showMaterials', { count: receta.detalle_materiales.length })}
              </span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs shrink-0 gap-1"
              onClick={() => setMaterialsDialogOpen(true)}
            >
              <Maximize2 className="w-3 h-3" />
              {t('produccion.recipeCard.viewAll')}
            </Button>
          </div>

          <RecetaMaterialsDialog
            open={materialsDialogOpen}
            onOpenChange={setMaterialsDialogOpen}
            receta={receta}
          />

          {materialsExpanded && (
            <div className="rounded-lg overflow-hidden border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 dark:bg-white/5">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-muted-foreground font-medium w-[min(50%,180px)]">{t('produccion.materialsDialog.columns.material')}</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">{t('produccion.materialsDialog.columns.stock')}</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">{t('produccion.materialsDialog.columns.perBox')}</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">{t('produccion.recipeMaterialsDialog.columns.reachesFor')}</th>
                  </tr>
                </thead>
                <tbody>
                  {receta.detalle_materiales.map((mat, i) => {
                    const isBot = i === 0 && isBad
                    return (
                      <tr key={`${mat.codigo}-${i}`} className={cn('border-t border-border', isBot ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-muted/40')}>
                        <td className="px-2 py-1.5 text-foreground max-w-[180px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isBot && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                            <span className="truncate min-w-0" title={mat.descripcion}>{mat.descripcion}</span>
                          </div>
                        </td>
                        <td className={cn('px-2 py-1.5 text-right font-mono', mat.stock_actual === 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-muted-foreground')}>
                          {mat.stock_actual === 0 ? t('produccion.stock.zeroWarning') : fmtK(mat.stock_actual)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">{mat.necesario_por_caja}</td>
                        <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', isBot ? 'text-red-700 dark:text-red-300' : 'text-foreground/70')}>
                          {mat.capacidad_aportada >= 999999 ? '∞' : t('produccion.boxes.count', { count: fmtK(mat.capacidad_aportada) })}
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
  const { t } = useLocale()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [expandedMaterialCards, setExpandedMaterialCards] = useState<Set<string>>(() => new Set())
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

  useEffect(() => {
    setExpandedMaterialCards(new Set())
  }, [page])

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
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">
              {t('produccion.varietySection.critical', { count: vCrit })}
            </span>
          )}
          {vBaj > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium">
              {t('produccion.varietySection.low', { count: vBaj })}
            </span>
          )}
        </div>
        <div className="h-px flex-1 bg-border/30 group-hover:bg-border/50 transition-colors" />
      </button>

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
            {paginatedItems.map((receta, idx) => {
              const cardId = `${variety}::${receta.codigo_receta}::${startIndex + idx}`
              return (
              <RecetaCard
                key={cardId}
                receta={receta}
                maxPallets={maxPallets}
                highlighted={highlightCodigos.includes(receta.codigo_receta)}
                materialsExpanded={expandedMaterialCards.has(cardId)}
                onToggleMaterials={() => {
                  setExpandedMaterialCards((prev) => {
                    const next = new Set(prev)
                    if (next.has(cardId)) next.delete(cardId)
                    else next.add(cardId)
                    return next
                  })
                }}
              />
              )
            })}
          </div>
          {hasPagination && (
            <TablePaginationBar
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={setPage}
              itemLabel={t('produccion.pagination.codes')}
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
  const { t, locale } = useLocale()
  const { fmt } = createNumberFormatters(locale)
  const [filter, setFilter] = useState<EstadoAlerta | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [highlightCodigos, setHighlightCodigos] = useState<string[]>([])
  const [allMaterialsOpen, setAllMaterialsOpen] = useState(false)

  const crits = useMemo(() => buildCritMats(data), [data])
  const materialsCatalog = useMemo(() => buildMaterialsCatalog(data, locale), [data, locale])

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 p-16 text-center">
        <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">{t('produccion.empty.title')}</p>
        <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">
          {t('produccion.empty.description')}
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

  const varieties = [...new Set(filtered.map((r) => r.variedad ?? t('produccion.noVariety')))]
  const groupedFiltered = new Map<string, CapacidadReceta[]>()
  for (const r of filtered) {
    const v = r.variedad ?? t('produccion.noVariety')
    const list = groupedFiltered.get(v) ?? []
    list.push(r)
    groupedFiltered.set(v, list)
  }

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString(localeToBcp47(locale), { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className="space-y-6">
      <AllMaterialsDialog
        open={allMaterialsOpen}
        onOpenChange={setAllMaterialsOpen}
        materials={materialsCatalog}
      />

      {updatedLabel && (
        <p className="text-xs text-muted-foreground">
          {t('produccion.inventoryUpdated', { date: updatedLabel })}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label={t('produccion.kpi.totalPallets')} value={totalPallets} sub={t('produccion.kpi.totalPalletsSub')} color="bg-primary/10 text-primary" icon={Boxes} fmt={fmt} />
        <KpiCard label={t('produccion.kpi.criticalCodes')} value={critCount} sub={`< ${UMBRAL_CRITICO_PALLETS} pallets`} color={critCount > 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-muted text-muted-foreground'} icon={PackageX} fmt={fmt} />
        <KpiCard label={t('produccion.kpi.lowStock')} value={bajCount} sub={`< ${UMBRAL_BAJO_PALLETS} pallets`} color={bajCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground'} icon={TrendingDown} fmt={fmt} />
        <KpiCard label={t('produccion.kpi.okCodes')} value={okCount} sub={`≥ ${UMBRAL_OK_PALLETS} pallets`} color={okCount > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'} icon={CheckCircle2} fmt={fmt} />
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
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border w-fit flex-wrap">
          {(
            [
              { key: 'todos',   label: t('produccion.filters.all', { count: data.length }),   cls: '' },
              { key: 'critico', label: t('produccion.filters.critical', { count: critCount }),  cls: 'text-red-600 dark:text-red-300'    },
              { key: 'bajo',    label: t('produccion.filters.low', { count: bajCount }), cls: 'text-amber-700 dark:text-amber-300'  },
              { key: 'ok',      label: t('produccion.filters.ok', { count: okCount }),          cls: 'text-emerald-700 dark:text-emerald-300'},
            ] as const
          ).map(({ key, label, cls }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key as EstadoAlerta | 'todos')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filter === key
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : cn('text-muted-foreground hover:text-foreground', cls),
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => setAllMaterialsOpen(true)}
        >
          <List className="w-4 h-4" />
          {t('produccion.viewAllMaterials', { count: materialsCatalog.length })}
        </Button>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('produccion.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t('produccion.noSearchResults')}
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

      <p className="text-[10px] text-muted-foreground text-center">
        {t('produccion.footerLegend', {
          step: PALLETS_STEP,
          critical: UMBRAL_CRITICO_PALLETS,
          low: UMBRAL_BAJO_PALLETS,
          ok: UMBRAL_OK_PALLETS,
        })}
      </p>
    </div>
  )
}
