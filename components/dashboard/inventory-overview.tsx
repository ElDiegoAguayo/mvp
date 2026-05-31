'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Warehouse, Search, ChevronLeft, ChevronRight,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, Package,
  AlertTriangle, CheckCircle2, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/i18n/locale-provider'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InventoryWarehouse { id: string; name: string }
interface InventoryMaterial  { id: string; name: string; unit: string }
interface InventoryMovement  {
  id: string; warehouse_id: string; material_id: string
  type: 'entrada' | 'salida' | 'ajuste'
  quantity: number; unit: string; movement_date: string
}
interface InventoryMinLevel  { id: string; warehouse_id: string; material_id: string; min_quantity: number }

interface StockRow {
  warehouseId: string; materialId: string
  warehouseName: string; materialName: string
  unit: string; stock: number
  lastMovementDate: string | null
  lastMovementType: InventoryMovement['type'] | null
  minQuantity: number | null
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const MOVEMENT_ICONS = {
  entrada: { icon: ArrowDownCircle, color: 'text-emerald-500' },
  salida:  { icon: ArrowUpCircle,   color: 'text-rose-500'    },
  ajuste:  { icon: RefreshCw,       color: 'text-amber-500'   },
} as const

// ─── Sub-components ────────────────────────────────────────────────────────────

function StockBar({ stock, minQuantity }: { stock: number; minQuantity: number | null }) {
  if (minQuantity === null || minQuantity === 0) return null
  const pct = Math.min(100, Math.max(0, (stock / (minQuantity * 2)) * 100))
  const isCritical = stock < minQuantity
  const isWarning  = stock < minQuantity * 1.3

  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mt-1">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function StatusBadge({ stock, minQuantity }: { stock: number; minQuantity: number | null }) {
  const { t } = useLocale()
  if (minQuantity === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
        <CheckCircle2 className="w-3 h-3" />
        {t('inventory.status.noMinimum')}
      </span>
    )
  }
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3" />
        {t('inventory.status.noStock')}
      </span>
    )
  }
  if (stock < minQuantity) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
        <TrendingDown className="w-3 h-3" />
        {t('inventory.status.belowMinimum')}
      </span>
    )
  }
  if (stock < minQuantity * 1.3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
        <AlertTriangle className="w-3 h-3" />
        {t('inventory.status.approaching')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
      <CheckCircle2 className="w-3 h-3" />
      {t('inventory.status.ok')}
    </span>
  )
}

function PaginationBar({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const { t } = useLocale()
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to   = Math.min((page + 1) * PAGE_SIZE, total)

  const pageNums: number[] = []
  for (let i = Math.max(0, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) pageNums.push(i)

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? t('common.empty.noResults')
          : t('common.pagination.rowsOf', { from, to, total })}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
            onClick={() => onChange(0)} disabled={page === 0}>
            <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-1" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
            onClick={() => onChange(page - 1)} disabled={page === 0}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          {pageNums[0] > 0 && <span className="text-xs text-muted-foreground px-1">…</span>}
          {pageNums.map(p => (
            <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
              className="h-7 w-7 p-0 text-xs"
              onClick={() => onChange(p)}>
              {p + 1}
            </Button>
          ))}
          {pageNums[pageNums.length - 1] < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
            onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
            onClick={() => onChange(totalPages - 1)} disabled={page >= totalPages - 1}>
            <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function InventoryOverview() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const supabase = useMemo(() => createClient(), [])

  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([])
  const [materials,  setMaterials]  = useState<InventoryMaterial[]>([])
  const [movements,  setMovements]  = useState<InventoryMovement[]>([])
  const [minLevels,  setMinLevels]  = useState<InventoryMinLevel[]>([])
  const [loading,    setLoading]    = useState(true)

  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [statusFilter,    setStatusFilter]    = useState('all')
  const [searchTerm,      setSearchTerm]      = useState('')
  const [page,            setPage]            = useState(0)

  // Reset page whenever filters change
  useEffect(() => { setPage(0) }, [warehouseFilter, statusFilter, searchTerm])

  const loadInventory = useCallback(async () => {
    setLoading(true)
    try {
      const { effectiveUserId } = await getEffectiveUserId(supabase)
      if (!effectiveUserId) { setLoading(false); return }

      const [warehouseRes, materialRes, movementRes, minLevelRes] = await Promise.all([
        supabase.from('inventory_warehouses').select('id, name').eq('user_id', effectiveUserId).order('name'),
        supabase.from('inventory_materials').select('id, name, unit').eq('user_id', effectiveUserId).order('name'),
        supabase.from('inventory_movements').select('id, warehouse_id, material_id, type, quantity, unit, movement_date').eq('user_id', effectiveUserId).order('movement_date', { ascending: false }),
        supabase.from('inventory_min_levels').select('id, warehouse_id, material_id, min_quantity').eq('user_id', effectiveUserId),
      ])

      setWarehouses((warehouseRes.data ?? []) as InventoryWarehouse[])
      setMaterials((materialRes.data ?? [])   as InventoryMaterial[])
      setMovements((movementRes.data ?? [])   as InventoryMovement[])
      setMinLevels((minLevelRes.data ?? [])   as InventoryMinLevel[])
    } catch (err) {
      console.error('Error loading inventory overview:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadInventory() }, [loadInventory])

  // ─── Compute stock rows ─────────────────────────────────────────────────────
  const stockRows = useMemo<StockRow[]>(() => {
    const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]))
    const materialMap  = new Map(materials.map(m => [m.id, m]))
    const minMap       = new Map(minLevels.map(l => [`${l.warehouse_id}:${l.material_id}`, l.min_quantity]))
    const stockMap     = new Map<string, StockRow>()

    for (const mv of movements) {
      const material   = materialMap.get(mv.material_id)
      const key        = `${mv.warehouse_id}:${mv.material_id}`
      const existing   = stockMap.get(key) ?? {
        warehouseId: mv.warehouse_id,
        materialId:  mv.material_id,
        warehouseName: warehouseMap.get(mv.warehouse_id) ?? t('inventory.fallback.warehouse'),
        materialName:  material?.name ?? t('inventory.fallback.material'),
        unit:          mv.unit || material?.unit || '—',
        stock:         0,
        lastMovementDate: null,
        lastMovementType: null,
        minQuantity:   minMap.get(key) ?? null,
      }

      const qty   = Number(mv.quantity) || 0
      existing.stock += mv.type === 'salida' ? -qty : qty
      if (!existing.lastMovementDate || mv.movement_date > existing.lastMovementDate) {
        existing.lastMovementDate = mv.movement_date
        existing.lastMovementType = mv.type
      }
      stockMap.set(key, existing)
    }

    return Array.from(stockMap.values()).sort(
      (a, b) => a.warehouseName.localeCompare(b.warehouseName) || a.materialName.localeCompare(b.materialName)
    )
  }, [warehouses, materials, movements, minLevels, t])

  // ─── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const critical = stockRows.filter(r => r.minQuantity !== null && r.stock < r.minQuantity).length
    const noStock  = stockRows.filter(r => r.stock <= 0).length
    const ok       = stockRows.filter(r => r.minQuantity === null || r.stock >= r.minQuantity).length
    return { total: stockRows.length, critical, noStock, ok }
  }, [stockRows])

  // ─── Filtered + paginated ────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return stockRows.filter(row => {
      if (warehouseFilter !== 'all' && row.warehouseId !== warehouseFilter) return false
      if (q && !row.materialName.toLowerCase().includes(q) && !row.warehouseName.toLowerCase().includes(q)) return false
      if (statusFilter === 'critical' && !(row.minQuantity !== null && row.stock < row.minQuantity)) return false
      if (statusFilter === 'ok'       && !(row.minQuantity === null || row.stock >= row.minQuantity)) return false
      if (statusFilter === 'nostock'  && row.stock > 0) return false
      return true
    })
  }, [stockRows, warehouseFilter, searchTerm, statusFilter])

  const pageRows    = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages  = Math.ceil(filteredRows.length / PAGE_SIZE)

  // ─── Render: loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('inventory.loading')}</p>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{t('inventory.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('inventory.subtitle')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadInventory} className="gap-1.5 h-8">
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.actions.refresh')}
        </Button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('inventory.kpi.total'), value: kpis.total, color: 'text-foreground', bg: 'bg-secondary/60', icon: Package },
          { label: t('inventory.kpi.ok'), value: kpis.ok, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
          { label: t('inventory.kpi.critical'), value: kpis.critical, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', icon: AlertTriangle },
          { label: t('inventory.kpi.noStock'), value: kpis.noStock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', icon: TrendingDown },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={cn('rounded-xl border border-border p-4 flex items-center gap-3', bg)}>
            <Icon className={cn('w-5 h-5 shrink-0', color)} />
            <div>
              <p className={cn('text-xl font-bold', color)}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table card ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

        {/* Filters row */}
        <div className="px-5 py-4 border-b border-border bg-secondary/30 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('inventory.searchPlaceholder')}
              className="pl-8 h-8 text-sm bg-background border-border"
            />
          </div>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-44 bg-background border-border">
              <SelectValue placeholder={t('inventory.filters.allWarehouses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('inventory.filters.allWarehouses')}</SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-40 bg-background border-border">
              <SelectValue placeholder={t('inventory.filters.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('inventory.filters.allStatuses')}</SelectItem>
              <SelectItem value="ok">{t('inventory.filters.okOnly')}</SelectItem>
              <SelectItem value="critical">{t('inventory.filters.critical')}</SelectItem>
              <SelectItem value="nostock">{t('inventory.filters.noStock')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <span className="text-xs text-muted-foreground">
              {t('inventory.resultCount', { count: filteredRows.length })}
            </span>
          </div>
        </div>

        {/* Table */}
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="w-10 h-10 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">{t('inventory.empty.filtered')}</p>
            {(searchTerm || warehouseFilter !== 'all' || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setWarehouseFilter('all'); setStatusFilter('all') }}>
                {t('common.actions.clearFilters')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('inventory.columns.warehouse')}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('inventory.columns.material')}</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('inventory.columns.stock')}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('inventory.columns.unit')}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('common.labels.status')}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('inventory.columns.lastMovement')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((row, idx) => {
                    const isCritical = row.minQuantity !== null && row.stock < row.minQuantity
                    const meta = row.lastMovementType ? MOVEMENT_ICONS[row.lastMovementType] : null
                    const MovIcon = meta?.icon
                    const movementLabel = row.lastMovementType
                      ? t(`inventory.movement.${row.lastMovementType}`)
                      : null

                    return (
                      <tr
                        key={`${row.warehouseId}-${row.materialId}`}
                        className={cn(
                          'transition-colors hover:bg-secondary/40',
                          isCritical && 'bg-rose-500/5 hover:bg-rose-500/10',
                          idx % 2 === 0 && !isCritical && 'bg-secondary/10'
                        )}
                      >
                        {/* Bodega */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <Warehouse className="w-3 h-3 text-primary" />
                            </div>
                            <span className="font-medium text-foreground">{row.warehouseName}</span>
                          </div>
                        </td>

                        {/* Material */}
                        <td className="px-5 py-3.5">
                          <span className="text-foreground">{row.materialName}</span>
                        </td>

                        {/* Stock */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={cn(
                              'font-bold tabular-nums text-base',
                              isCritical ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                            )}>
                              {row.stock.toLocaleString(dateLocale)}
                            </span>
                            {row.minQuantity !== null && (
                              <>
                                <span className="text-[10px] text-muted-foreground">
                                  {t('inventory.stockMinimumPrefix')} {row.minQuantity.toLocaleString(dateLocale)}
                                </span>
                                <StockBar stock={row.stock} minQuantity={row.minQuantity} />
                              </>
                            )}
                          </div>
                        </td>

                        {/* Unidad */}
                        <td className="px-5 py-3.5">
                          <Badge variant="secondary" className="text-xs font-mono">{row.unit}</Badge>
                        </td>

                        {/* Estado */}
                        <td className="px-5 py-3.5">
                          <StatusBadge stock={row.stock} minQuantity={row.minQuantity} />
                        </td>

                        {/* Ultimo movimiento */}
                        <td className="px-5 py-3.5">
                          {row.lastMovementDate && meta && MovIcon ? (
                            <div className="flex items-center gap-2">
                              <MovIcon className={cn('w-3.5 h-3.5 shrink-0', meta.color)} />
                              <div>
                                <p className="text-xs font-medium text-foreground">
                                  {new Date(row.lastMovementDate).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <p className={cn('text-[10px] font-medium', meta.color)}>{movementLabel}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationBar page={page} total={filteredRows.length} onChange={setPage} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
