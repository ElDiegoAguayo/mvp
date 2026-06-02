'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getPhytoDashboardStatsAction,
  listPhytoProductsAction,
  listPhytoStockAction,
  listPhytoWarehousesAction,
  registerPhytoMovementAction,
} from '@/app/actions/fitosanitario-actions'
import { listPhytoMovementsFullAction } from '@/app/actions/fitosanitario-extended-actions'
import type { PhytoMovement, PhytoMovementType, PhytoProduct, PhytoProductCategory, PhytoStockRow, PhytoWarehouse } from '@/lib/fitosanitario/types'
import { stockStatus } from '@/lib/fitosanitario/stock'
import { PHYTO_CATEGORY_OPTIONS } from '@/lib/fitosanitario/categories'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  Warehouse,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { cn } from '@/lib/utils'
import { PhytoTablePagination } from '@/components/dashboard/fitosanitario/phyto-table-pagination'
import { PHYTO_PAGE_SIZE } from '@/lib/fitosanitario/constants'
import { usePagination } from '@/hooks/use-pagination'

const MOVEMENT_TYPES: PhytoMovementType[] = ['entrada', 'salida', 'ajuste']
const CATEGORIES = PHYTO_CATEGORY_OPTIONS

function StatusBadge({ stock, minStock }: { stock: number; minStock: number | null }) {
  const { t } = useLocale()
  const status = stockStatus(stock, minStock)
  const map = {
    ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    low: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    critical: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
    none: 'bg-secondary text-muted-foreground border-border',
  }
  return (
    <Badge variant="outline" className={cn('font-medium', map[status])}>
      {t(`fitosanitario.stock.status.${status}`)}
    </Badge>
  )
}

export function PhytoStockManager() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const [stock, setStock] = useState<PhytoStockRow[]>([])
  const [movements, setMovements] = useState<PhytoMovement[]>([])
  const [warehouses, setWarehouses] = useState<PhytoWarehouse[]>([])
  const [products, setProducts] = useState<PhytoProduct[]>([])
  const [stats, setStats] = useState({ warehouses: 0, products: 0, lowStock: 0, movements30d: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [movForm, setMovForm] = useState({
    warehouse_id: '',
    product_id: '',
    type: 'entrada' as PhytoMovementType,
    quantity: '',
    movement_date: new Date().toISOString().slice(0, 10),
    lot_number: '',
    expiry_date: '',
    reference: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [stockRes, movRes, statsRes, wRes, pRes] = await Promise.all([
      listPhytoStockAction(),
      listPhytoMovementsFullAction(500),
      getPhytoDashboardStatsAction(),
      listPhytoWarehousesAction(),
      listPhytoProductsAction(),
    ])
    if (stockRes.ok) setStock(stockRes.data)
    else toast.error(stockRes.message)
    if (movRes.ok) setMovements(movRes.data)
    if (statsRes.ok) setStats(statsRes.stats)
    if (wRes.ok) setWarehouses(wRes.data.filter(w => w.is_active))
    if (pRes.ok) setProducts(pRes.data.filter(p => p.is_active))
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stock.filter(row => {
      if (warehouseFilter !== 'all' && row.warehouse_id !== warehouseFilter) return false
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false
      if (!q) return true
      return (
        row.product_name.toLowerCase().includes(q)
        || row.warehouse_name.toLowerCase().includes(q)
        || row.supplier_name.toLowerCase().includes(q)
      )
    })
  }, [stock, search, warehouseFilter, categoryFilter])

  const stockPagination = usePagination(filtered, PHYTO_PAGE_SIZE)
  const movementsPagination = usePagination(movements, PHYTO_PAGE_SIZE)

  const openMovement = (preset?: Partial<typeof movForm>) => {
    setMovForm({
      warehouse_id: preset?.warehouse_id ?? warehouses[0]?.id ?? '',
      product_id: preset?.product_id ?? products[0]?.id ?? '',
      type: preset?.type ?? 'entrada',
      quantity: preset?.quantity ?? '',
      movement_date: new Date().toISOString().slice(0, 10),
      lot_number: '',
      expiry_date: '',
      reference: '',
      notes: '',
    })
    setDialogOpen(true)
  }

  const selectedProduct = products.find(p => p.id === movForm.product_id)

  const handleRegisterMovement = () => {
    if (!movForm.warehouse_id || !movForm.product_id || !movForm.quantity) {
      toast.error('Completa bodega, producto y cantidad')
      return
    }
    startTransition(async () => {
      const res = await registerPhytoMovementAction({
        warehouse_id: movForm.warehouse_id,
        product_id: movForm.product_id,
        type: movForm.type,
        quantity: Number(movForm.quantity),
        unit: selectedProduct?.unit,
        lot_number: movForm.lot_number,
        expiry_date: movForm.expiry_date || null,
        reference: movForm.reference,
        notes: movForm.notes,
        movement_date: movForm.movement_date,
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('fitosanitario.movementDialog.saved'))
      setDialogOpen(false)
      await load()
    })
  }

  const kpis = [
    { label: t('fitosanitario.stock.kpis.warehouses'), value: stats.warehouses, icon: Warehouse, color: 'text-sky-600' },
    { label: t('fitosanitario.stock.kpis.products'), value: stats.products, icon: Package, color: 'text-lime-600' },
    { label: t('fitosanitario.stock.kpis.lowStock'), value: stats.lowStock, icon: TrendingDown, color: 'text-amber-600' },
    { label: t('fitosanitario.stock.kpis.movements30d'), value: stats.movements30d, icon: RefreshCw, color: 'text-violet-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <p className="text-2xl font-bold mt-2 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <DashboardCard
        header={
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
            <h2 className="text-lg font-semibold">{t('fitosanitario.stock.title')}</h2>
            <Button onClick={() => openMovement()} disabled={warehouses.length === 0 || products.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              {t('fitosanitario.stock.registerMovement')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t('fitosanitario.stock.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('fitosanitario.stock.allWarehouses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('fitosanitario.stock.allWarehouses')}</SelectItem>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('fitosanitario.stock.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('fitosanitario.stock.allCategories')}</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{t(`fitosanitario.categories.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('fitosanitario.stock.empty')}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>{t('fitosanitario.stock.columns.warehouse')}</TableHead>
                    <TableHead>{t('fitosanitario.stock.columns.field')}</TableHead>
                    <TableHead>{t('fitosanitario.stock.columns.product')}</TableHead>
                    <TableHead>{t('fitosanitario.stock.columns.type')}</TableHead>
                    <TableHead className="text-right">{t('fitosanitario.stock.columns.entries')}</TableHead>
                    <TableHead className="text-right">{t('fitosanitario.stock.columns.exits')}</TableHead>
                    <TableHead className="text-right">{t('fitosanitario.stock.columns.stock')}</TableHead>
                    <TableHead>{t('fitosanitario.stock.columns.supplier')}</TableHead>
                    <TableHead>{t('fitosanitario.stock.columns.status')}</TableHead>
                    <TableHead className="text-right">{t('fitosanitario.stock.columns.lastMovement')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockPagination.paginatedItems.map(row => (
                    <TableRow
                      key={`${row.warehouse_id}:${row.product_id}`}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => openMovement({
                        warehouse_id: row.warehouse_id,
                        product_id: row.product_id,
                        type: 'salida',
                      })}
                    >
                      <TableCell className="font-medium">{row.warehouse_name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.field_name || '—'}</TableCell>
                      <TableCell>{row.product_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.product_type_label || t(`fitosanitario.categories.${row.category}`)}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {row.entries_total.toLocaleString(dateLocale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-rose-600">
                        {row.exits_total.toLocaleString(dateLocale)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {row.stock.toLocaleString(dateLocale)} {row.unit}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.supplier_name || '—'}</TableCell>
                      <TableCell><StatusBadge stock={row.stock} minStock={row.min_stock} /></TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {row.last_movement_date
                          ? new Date(row.last_movement_date).toLocaleDateString(dateLocale)
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PhytoTablePagination
                page={stockPagination.page}
                totalPages={stockPagination.totalPages}
                totalItems={stockPagination.totalItems}
                startIndex={stockPagination.startIndex}
                endIndex={stockPagination.endIndex}
                onPageChange={stockPagination.setPage}
              />
            </div>
          )}
        </div>
      </DashboardCard>

      <DashboardCard header={<h3 className="font-semibold">{t('fitosanitario.stock.recentMovements')}</h3>}>
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Sin movimientos recientes.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movementsPagination.paginatedItems.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{new Date(m.movement_date).toLocaleDateString(dateLocale)}</TableCell>
                  <TableCell>{m.warehouse?.name ?? '—'}</TableCell>
                  <TableCell>{m.product?.name ?? '—'}</TableCell>
                  <TableCell>
                    <span className={cn(
                      'inline-flex items-center gap-1 text-sm font-medium',
                      m.type === 'entrada' ? 'text-emerald-600' : m.type === 'salida' ? 'text-rose-600' : 'text-amber-600',
                    )}>
                      {m.type === 'entrada' ? <ArrowDownCircle className="w-3.5 h-3.5" /> : m.type === 'salida' ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {t(`fitosanitario.movementTypes.${m.type}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {m.type === 'salida' ? '−' : '+'}{m.quantity} {m.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PhytoTablePagination
            page={movementsPagination.page}
            totalPages={movementsPagination.totalPages}
            totalItems={movementsPagination.totalItems}
            startIndex={movementsPagination.startIndex}
            endIndex={movementsPagination.endIndex}
            onPageChange={movementsPagination.setPage}
          />
          </div>
        )}
      </DashboardCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('fitosanitario.movementDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('fitosanitario.movementDialog.type')}</Label>
              <Select value={movForm.type} onValueChange={v => setMovForm(f => ({ ...f, type: v as PhytoMovementType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{t(`fitosanitario.movementTypes.${type}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.movementDialog.warehouse')}</Label>
              <Select value={movForm.warehouse_id} onValueChange={v => setMovForm(f => ({ ...f, warehouse_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.movementDialog.product')}</Label>
              <Select value={movForm.product_id} onValueChange={v => setMovForm(f => ({ ...f, product_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('fitosanitario.movementDialog.quantity')}</Label>
                <Input type="number" min={0} step="any" value={movForm.quantity} onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('fitosanitario.movementDialog.date')}</Label>
                <Input type="date" value={movForm.movement_date} onChange={e => setMovForm(f => ({ ...f, movement_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('fitosanitario.movementDialog.lot')}</Label>
                <Input value={movForm.lot_number} onChange={e => setMovForm(f => ({ ...f, lot_number: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('fitosanitario.movementDialog.expiry')}</Label>
                <Input type="date" value={movForm.expiry_date} onChange={e => setMovForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.movementDialog.reference')}</Label>
              <Input value={movForm.reference} onChange={e => setMovForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.movementDialog.notes')}</Label>
              <Textarea rows={2} value={movForm.notes} onChange={e => setMovForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegisterMovement} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
