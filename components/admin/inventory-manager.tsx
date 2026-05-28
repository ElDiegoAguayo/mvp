'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Loader2, PackagePlus, Warehouse, Pencil, Trash2, Plus, Search,
  ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, RefreshCw,
  BarChart3, AlertTriangle, Package, TrendingUp, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface InventoryWarehouse { id: string; name: string; location: string | null }
interface InventoryMaterial { id: string; warehouse_id: string; name: string; unit: string }
interface InventoryMovement {
  id: string; warehouse_id: string; material_id: string
  type: 'entrada' | 'salida' | 'ajuste'
  quantity: number; unit: string; cost: number | null
  responsible: string | null; observation: string | null
  movement_date: string; created_at: string
}
interface InventoryMinLevel { id: string; warehouse_id: string; material_id: string; min_quantity: number }
interface WarehouseReportRow {
  warehouseId: string; warehouseName: string
  entradas: number; salidas: number; ajustes: number
  stockFinal: number; avgCost: number | null
}

const PAGE_SIZE = 10
const MOVEMENT_TYPES = [
  { value: 'entrada', label: 'Entrada', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400', icon: ArrowDownCircle },
  { value: 'salida',  label: 'Salida',  color: 'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400',         icon: ArrowUpCircle },
  { value: 'ajuste',  label: 'Ajuste',  color: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',     icon: RefreshCw },
] as const

function MovementBadge({ type }: { type: InventoryMovement['type'] }) {
  const cfg = MOVEMENT_TYPES.find(t => t.value === type)!
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  // Build visible page numbers (max 5 shown)
  const pageNumbers: number[] = []
  const delta = 2
  for (let i = Math.max(0, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
    pageNumbers.push(i)
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
      <p className="text-xs text-muted-foreground">
        {total === 0 ? 'Sin resultados' : <>Filas <span className="font-semibold text-foreground">{from}–{to}</span> de <span className="font-semibold text-foreground">{total}</span></>}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => onChange(page - 1)} disabled={page === 0}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          {pageNumbers[0] > 0 && (
            <>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => onChange(0)}>1</Button>
              {pageNumbers[0] > 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
            </>
          )}
          {pageNumbers.map(p => (
            <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
              className={cn('h-7 w-7 p-0 text-xs', p === page && 'shadow-sm')}
              onClick={() => onChange(p)}>
              {p + 1}
            </Button>
          ))}
          {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => onChange(totalPages - 1)}>{totalPages}</Button>
            </>
          )}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function InventoryManager({ clientId }: { clientId: string }) {
  const supabase = createClient()

  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([])
  const [materials, setMaterials] = useState<InventoryMaterial[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [minLevels, setMinLevels] = useState<InventoryMinLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formCollapsed, setFormCollapsed] = useState(false)

  // Pagination
  const [movPage, setMovPage] = useState(0)
  const [minPage, setMinPage] = useState(0)

  // Filters
  const [movSearch, setMovSearch] = useState('')
  const [movTypeFilter, setMovTypeFilter] = useState('all')
  const [movWarehouseFilter, setMovWarehouseFilter] = useState('all')

  // Warehouse form
  const [warehouseName, setWarehouseName] = useState('')
  const [warehouseLocation, setWarehouseLocation] = useState('')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [editingWarehouse, setEditingWarehouse] = useState<InventoryWarehouse | null>(null)
  const [editWarehouseName, setEditWarehouseName] = useState('')
  const [editWarehouseLocation, setEditWarehouseLocation] = useState('')

  // Material form
  const [materialName, setMaterialName] = useState('')
  const [materialUnit, setMaterialUnit] = useState('')
  const [materialWarehouse, setMaterialWarehouse] = useState('')
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [editingMaterial, setEditingMaterial] = useState<InventoryMaterial | null>(null)
  const [editMaterialName, setEditMaterialName] = useState('')
  const [editMaterialUnit, setEditMaterialUnit] = useState('')
  const [editMaterialWarehouse, setEditMaterialWarehouse] = useState('')

  // Movement form
  const [movementWarehouse, setMovementWarehouse] = useState('')
  const [movementMaterial, setMovementMaterial] = useState('')
  const [movementType, setMovementType] = useState<InventoryMovement['type']>('entrada')
  const [movementQuantity, setMovementQuantity] = useState('')
  const [movementUnit, setMovementUnit] = useState('')
  const [movementCost, setMovementCost] = useState('')
  const [movementResponsible, setMovementResponsible] = useState('')
  const [movementObservation, setMovementObservation] = useState('')
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [editingMovement, setEditingMovement] = useState<InventoryMovement | null>(null)
  const [editMovementWarehouse, setEditMovementWarehouse] = useState('')
  const [editMovementMaterial, setEditMovementMaterial] = useState('')
  const [editMovementType, setEditMovementType] = useState<InventoryMovement['type']>('entrada')
  const [editMovementQuantity, setEditMovementQuantity] = useState('')
  const [editMovementUnit, setEditMovementUnit] = useState('')
  const [editMovementCost, setEditMovementCost] = useState('')
  const [editMovementResponsible, setEditMovementResponsible] = useState('')
  const [editMovementObservation, setEditMovementObservation] = useState('')
  const [editMovementDate, setEditMovementDate] = useState('')

  // Min level form
  const [minWarehouse, setMinWarehouse] = useState('')
  const [minMaterial, setMinMaterial] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [editingMinLevel, setEditingMinLevel] = useState<InventoryMinLevel | null>(null)
  const [editMinWarehouse, setEditMinWarehouse] = useState('')
  const [editMinMaterial, setEditMinMaterial] = useState('')
  const [editMinQuantity, setEditMinQuantity] = useState('')

  // Report
  const [reportStart, setReportStart] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  })
  const [reportEnd, setReportEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [usdRate, setUsdRate] = useState('900')

  // Delete
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'warehouse' | 'material' | 'movement' | 'minlevel'; id: string; label: string } | null>(null)

  // ─── Maps ──────────────────────────────────────────────────────────────────
  const warehouseNameMap = useMemo(() => new Map(warehouses.map(w => [w.id, w.name])), [warehouses])
  const materialNameMap = useMemo(() => new Map(materials.map(m => [m.id, m.name])), [materials])
  const materialUnitMap = useMemo(() => new Map(materials.map(m => [m.id, m.unit])), [materials])

  const stockMap = useMemo(() => {
    const map = new Map<string, number>()
    movements.forEach(mov => {
      const key = `${mov.warehouse_id}:${mov.material_id}`
      const q = Number(mov.quantity) || 0
      map.set(key, (map.get(key) ?? 0) + (mov.type === 'salida' ? -q : q))
    })
    return map
  }, [movements])

  const minLevelMap = useMemo(() => {
    const map = new Map<string, number>()
    minLevels.forEach(l => map.set(`${l.warehouse_id}:${l.material_id}`, Number(l.min_quantity) || 0))
    return map
  }, [minLevels])

  const alertCount = useMemo(() => {
    return minLevels.filter(l => {
      const stock = stockMap.get(`${l.warehouse_id}:${l.material_id}`) ?? 0
      return stock <= l.min_quantity
    }).length
  }, [minLevels, stockMap])

  const selectedWarehouse = useMemo(() => warehouses.find(w => w.id === selectedWarehouseId) ?? null, [warehouses, selectedWarehouseId])
  const selectedMaterial = useMemo(() => materials.find(m => m.id === selectedMaterialId) ?? null, [materials, selectedMaterialId])
  const materialsForMovement = useMemo(() => movementWarehouse ? materials.filter(m => m.warehouse_id === movementWarehouse) : [], [materials, movementWarehouse])
  const materialsForMinLevel = useMemo(() => minWarehouse ? materials.filter(m => m.warehouse_id === minWarehouse) : [], [materials, minWarehouse])
  const materialsForEditMovement = useMemo(() => editMovementWarehouse ? materials.filter(m => m.warehouse_id === editMovementWarehouse) : [], [materials, editMovementWarehouse])
  const materialsForEditMinLevel = useMemo(() => editMinWarehouse ? materials.filter(m => m.warehouse_id === editMinWarehouse) : [], [materials, editMinWarehouse])

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter(mov => {
      if (movTypeFilter !== 'all' && mov.type !== movTypeFilter) return false
      if (movWarehouseFilter !== 'all' && mov.warehouse_id !== movWarehouseFilter) return false
      if (movSearch) {
        const q = movSearch.toLowerCase()
        const mat = materialNameMap.get(mov.material_id)?.toLowerCase() ?? ''
        const wh = warehouseNameMap.get(mov.warehouse_id)?.toLowerCase() ?? ''
        const resp = mov.responsible?.toLowerCase() ?? ''
        if (!mat.includes(q) && !wh.includes(q) && !resp.includes(q)) return false
      }
      return true
    })
  }, [movements, movTypeFilter, movWarehouseFilter, movSearch, materialNameMap, warehouseNameMap])

  const pagedMovements = useMemo(() => filteredMovements.slice(movPage * PAGE_SIZE, (movPage + 1) * PAGE_SIZE), [filteredMovements, movPage])
  const pagedMinLevels = useMemo(() => minLevels.slice(minPage * PAGE_SIZE, (minPage + 1) * PAGE_SIZE), [minLevels, minPage])

  // ─── Load ──────────────────────────────────────────────────────────────────
  const loadInventory = useCallback(async () => {
    setLoading(true)
    try {
      const [wr, mr, movr, mlr] = await Promise.all([
        supabase.from('inventory_warehouses').select('id, name, location').eq('user_id', clientId).order('name'),
        supabase.from('inventory_materials').select('id, name, unit, warehouse_id').eq('user_id', clientId).order('name'),
        supabase.from('inventory_movements').select('id, warehouse_id, material_id, type, quantity, unit, cost, responsible, observation, movement_date, created_at').eq('user_id', clientId).order('movement_date', { ascending: false }).order('created_at', { ascending: false }).limit(500),
        supabase.from('inventory_min_levels').select('id, warehouse_id, material_id, min_quantity').eq('user_id', clientId),
      ])
      if (wr.error) throw wr.error
      if (mr.error) throw mr.error
      if (movr.error) throw movr.error
      setWarehouses(wr.data ?? [])
      setMaterials(mr.data ?? [])
      setMovements(movr.data ?? [])
      setMinLevels(mlr.data ?? [])
    } catch { toast.error('No se pudo cargar el inventario.') }
    finally { setLoading(false) }
  }, [clientId, supabase])

  useEffect(() => { loadInventory() }, [loadInventory])

  useEffect(() => {
    if (movementMaterial) { const u = materialUnitMap.get(movementMaterial); if (u) setMovementUnit(u) }
  }, [materialUnitMap, movementMaterial])

  useEffect(() => {
    if (movementWarehouse) { const valid = materials.some(m => m.id === movementMaterial && m.warehouse_id === movementWarehouse); if (!valid) setMovementMaterial('') }
  }, [materials, movementMaterial, movementWarehouse])

  useEffect(() => {
    if (minWarehouse) { const valid = materials.some(m => m.id === minMaterial && m.warehouse_id === minWarehouse); if (!valid) setMinMaterial('') }
  }, [materials, minMaterial, minWarehouse])

  useEffect(() => {
    if (editMovementWarehouse) { const valid = materials.some(m => m.id === editMovementMaterial && m.warehouse_id === editMovementWarehouse); if (!valid) setEditMovementMaterial('') }
  }, [materials, editMovementMaterial, editMovementWarehouse])

  useEffect(() => {
    if (editMinWarehouse) { const valid = materials.some(m => m.id === editMinMaterial && m.warehouse_id === editMinWarehouse); if (!valid) setEditMinMaterial('') }
  }, [materials, editMinMaterial, editMinWarehouse])

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleAddWarehouse = async () => {
    if (!warehouseName.trim()) { toast.error('Ingresa el nombre de la bodega.'); return }
    setSaving(true)
    const { error } = await supabase.from('inventory_warehouses').insert({ user_id: clientId, name: warehouseName.trim(), location: warehouseLocation.trim() || null })
    setSaving(false)
    if (error) { toast.error('No se pudo crear la bodega.'); return }
    setWarehouseName(''); setWarehouseLocation('')
    toast.success('Bodega creada.'); loadInventory()
  }

  const handleAddMaterial = async () => {
    if (!materialWarehouse || !materialName.trim() || !materialUnit.trim()) { toast.error('Completa todos los campos.'); return }
    setSaving(true)
    const { error } = await supabase.from('inventory_materials').insert({ user_id: clientId, warehouse_id: materialWarehouse, name: materialName.trim(), unit: materialUnit.trim() })
    setSaving(false)
    if (error) { toast.error('No se pudo crear el material.'); return }
    setMaterialName(''); setMaterialUnit(''); setMaterialWarehouse('')
    toast.success('Material creado.'); loadInventory()
  }

  const handleUpdateWarehouse = async () => {
    if (!editingWarehouse || !editWarehouseName.trim()) { toast.error('Ingresa el nombre.'); return }
    setSaving(true)
    const { error } = await supabase.from('inventory_warehouses').update({ name: editWarehouseName.trim(), location: editWarehouseLocation.trim() || null }).eq('id', editingWarehouse.id).eq('user_id', clientId)
    setSaving(false)
    if (error) { toast.error('Error al actualizar.'); return }
    setEditingWarehouse(null); toast.success('Bodega actualizada.'); loadInventory()
  }

  const handleUpdateMaterial = async () => {
    if (!editingMaterial || !editMaterialWarehouse || !editMaterialName.trim() || !editMaterialUnit.trim()) { toast.error('Completa todos los campos.'); return }
    setSaving(true)
    const { error } = await supabase.from('inventory_materials').update({ warehouse_id: editMaterialWarehouse, name: editMaterialName.trim(), unit: editMaterialUnit.trim() }).eq('id', editingMaterial.id).eq('user_id', clientId)
    setSaving(false)
    if (error) { toast.error('Error al actualizar.'); return }
    setEditingMaterial(null); toast.success('Material actualizado.'); loadInventory()
  }

  const handleAddMovement = async () => {
    if (!movementWarehouse || !movementMaterial) { toast.error('Selecciona bodega y material.'); return }
    const quantity = Number(movementQuantity)
    if (!Number.isFinite(quantity) || quantity === 0) { toast.error('Ingresa una cantidad valida.'); return }
    if (!movementUnit.trim()) { toast.error('Ingresa la unidad.'); return }
    setSaving(true)
    const { error } = await supabase.from('inventory_movements').insert({ user_id: clientId, warehouse_id: movementWarehouse, material_id: movementMaterial, type: movementType, quantity, unit: movementUnit.trim(), cost: movementCost ? Number(movementCost) : null, responsible: movementResponsible.trim() || null, observation: movementObservation.trim() || null, movement_date: movementDate })
    setSaving(false)
    if (error) { toast.error('Error al registrar.'); return }
    setMovementQuantity(''); setMovementCost(''); setMovementResponsible(''); setMovementObservation('')
    toast.success('Movimiento registrado.'); loadInventory()
  }

  const handleUpdateMovement = async () => {
    if (!editingMovement || !editMovementWarehouse || !editMovementMaterial) { toast.error('Completa los campos.'); return }
    const quantity = Number(editMovementQuantity)
    if (!Number.isFinite(quantity) || quantity === 0) { toast.error('Cantidad invalida.'); return }
    setSaving(true)
    const { error } = await supabase.from('inventory_movements').update({ warehouse_id: editMovementWarehouse, material_id: editMovementMaterial, type: editMovementType, quantity, unit: editMovementUnit.trim(), cost: editMovementCost ? Number(editMovementCost) : null, responsible: editMovementResponsible.trim() || null, observation: editMovementObservation.trim() || null, movement_date: editMovementDate }).eq('id', editingMovement.id).eq('user_id', clientId)
    setSaving(false)
    if (error) { toast.error('Error al actualizar.'); return }
    setEditingMovement(null); toast.success('Movimiento actualizado.'); loadInventory()
  }

  const handleSaveMinLevel = async () => {
    if (!minWarehouse || !minMaterial) { toast.error('Selecciona bodega y material.'); return }
    const quantity = Number(minQuantity)
    if (!Number.isFinite(quantity)) { toast.error('Minimo invalido.'); return }
    setSaving(true)
    const { error } = await supabase.from('inventory_min_levels').upsert({ user_id: clientId, warehouse_id: minWarehouse, material_id: minMaterial, min_quantity: quantity, updated_at: new Date().toISOString() }, { onConflict: 'user_id,warehouse_id,material_id' })
    setSaving(false)
    if (error) { toast.error('Error al guardar.'); return }
    setMinQuantity(''); toast.success('Minimo guardado.'); loadInventory()
  }

  const handleUpdateMinLevel = async () => {
    if (!editingMinLevel || !editMinWarehouse || !editMinMaterial) { toast.error('Completa los campos.'); return }
    const quantity = Number(editMinQuantity)
    if (!Number.isFinite(quantity)) { toast.error('Minimo invalido.'); return }
    setSaving(true)
    const { error } = await supabase.from('inventory_min_levels').update({ warehouse_id: editMinWarehouse, material_id: editMinMaterial, min_quantity: quantity, updated_at: new Date().toISOString() }).eq('id', editingMinLevel.id).eq('user_id', clientId)
    setSaving(false)
    if (error) { toast.error('Error al actualizar.'); return }
    setEditingMinLevel(null); toast.success('Minimo actualizado.'); loadInventory()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    const tableMap = { warehouse: 'inventory_warehouses', material: 'inventory_materials', movement: 'inventory_movements', minlevel: 'inventory_min_levels' } as const
    const { error } = await supabase.from(tableMap[deleteTarget.type]).delete().eq('id', deleteTarget.id).eq('user_id', clientId)
    setSaving(false)
    if (error) { toast.error('No se pudo eliminar.'); return }
    setShowDeleteDialog(false); setDeleteTarget(null)
    toast.success('Eliminado correctamente.'); loadInventory()
  }

  const openEditWarehouse = (w: InventoryWarehouse) => { setEditingWarehouse(w); setEditWarehouseName(w.name); setEditWarehouseLocation(w.location ?? '') }
  const openEditMaterial = (m: InventoryMaterial) => { setEditingMaterial(m); setEditMaterialName(m.name); setEditMaterialUnit(m.unit); setEditMaterialWarehouse(m.warehouse_id) }
  const openEditMovement = (mov: InventoryMovement) => { setEditingMovement(mov); setEditMovementWarehouse(mov.warehouse_id); setEditMovementMaterial(mov.material_id); setEditMovementType(mov.type); setEditMovementQuantity(String(mov.quantity ?? '')); setEditMovementUnit(mov.unit); setEditMovementCost(mov.cost === null ? '' : String(mov.cost)); setEditMovementResponsible(mov.responsible ?? ''); setEditMovementObservation(mov.observation ?? ''); setEditMovementDate(mov.movement_date) }
  const openEditMinLevel = (l: InventoryMinLevel) => { setEditingMinLevel(l); setEditMinWarehouse(l.warehouse_id); setEditMinMaterial(l.material_id); setEditMinQuantity(String(l.min_quantity ?? '')) }

  const formatClp = (v: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
  const formatUsd = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)
  const parsedUsdRate = Number(usdRate)

  const reportRows = useMemo<WarehouseReportRow[]>(() => {
    const start = reportStart ? new Date(reportStart) : null
    const end = reportEnd ? new Date(reportEnd) : null
    const reportMap = new Map<string, WarehouseReportRow>()
    const costMap = new Map<string, { totalCost: number; totalQty: number }>()
    const withinRange = movements.filter(m => {
      const d = new Date(m.movement_date)
      if (start && d < start) return false
      if (end && d > end) return false
      return true
    })
    withinRange.forEach(m => {
      const wn = warehouseNameMap.get(m.warehouse_id) ?? 'Bodega'
      const entry = reportMap.get(m.warehouse_id) || { warehouseId: m.warehouse_id, warehouseName: wn, entradas: 0, salidas: 0, ajustes: 0, stockFinal: 0, avgCost: null }
      const q = Number(m.quantity) || 0
      if (m.type === 'entrada') entry.entradas += q
      if (m.type === 'salida') entry.salidas += q
      if (m.type === 'ajuste') entry.ajustes += q
      if (m.type !== 'salida' && m.cost != null) {
        const ce = costMap.get(m.warehouse_id) || { totalCost: 0, totalQty: 0 }
        ce.totalCost += Number(m.cost) * q; ce.totalQty += q
        costMap.set(m.warehouse_id, ce)
      }
      reportMap.set(m.warehouse_id, entry)
    })
    movements.filter(m => !end || new Date(m.movement_date) <= end).forEach(m => {
      const entry = reportMap.get(m.warehouse_id)
      if (!entry) return
      const q = Number(m.quantity) || 0
      entry.stockFinal += m.type === 'salida' ? -q : q
    })
    return Array.from(reportMap.values()).map(row => {
      const ce = costMap.get(row.warehouseId)
      return { ...row, avgCost: ce && ce.totalQty > 0 ? ce.totalCost / ce.totalQty : null }
    }).sort((a, b) => a.warehouseName.localeCompare(b.warehouseName))
  }, [movements, reportEnd, reportStart, warehouseNameMap])

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Cargando inventario...</p>
      </div>
    )
  }

  const totalStock = Array.from(stockMap.values()).reduce((a, b) => a + Math.max(0, b), 0)

  // Report totals
  const reportTotals = reportRows.reduce((acc, row) => ({
    entradas: acc.entradas + row.entradas,
    salidas: acc.salidas + row.salidas,
    ajustes: acc.ajustes + row.ajustes,
    stockFinal: acc.stockFinal + row.stockFinal,
  }), { entradas: 0, salidas: 0, ajustes: 0, stockFinal: 0 })

  const kpiCards = [
    { label: 'Bodegas',     value: warehouses.length, sub: 'activas',        icon: Warehouse,      iconBg: 'bg-blue-500/10 border-blue-500/20',   iconColor: 'text-blue-500',    accent: 'border-l-blue-500'   },
    { label: 'Materiales',  value: materials.length,  sub: 'registrados',    icon: Package,        iconBg: 'bg-emerald-500/10 border-emerald-500/20', iconColor: 'text-emerald-500', accent: 'border-l-emerald-500' },
    { label: 'Movimientos', value: movements.length,  sub: `stock: ${totalStock}`, icon: BarChart3, iconBg: 'bg-purple-500/10 border-purple-500/20', iconColor: 'text-purple-500',  accent: 'border-l-purple-500'  },
    { label: 'Alertas',     value: alertCount,        sub: alertCount > 0 ? 'stock critico' : 'todo en orden', icon: AlertTriangle,
      iconBg: alertCount > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-secondary border-border',
      iconColor: alertCount > 0 ? 'text-rose-500' : 'text-muted-foreground',
      accent: alertCount > 0 ? 'border-l-rose-500' : 'border-l-border' },
  ]

  return (
    <div className="space-y-5">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map(card => (
          <div key={card.label} className={cn(
            'relative bg-card border border-border border-l-4 rounded-xl p-4 flex items-center gap-3 overflow-hidden',
            'hover:shadow-md transition-shadow duration-200',
            card.accent
          )}>
            <div className={cn('w-11 h-11 rounded-xl border-2 flex items-center justify-center shrink-0', card.iconBg)}>
              <card.icon className={cn('w-5 h-5', card.iconColor)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
              <p className="text-3xl font-bold text-foreground leading-none tabular-nums mt-0.5">{card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="movimientos" className="space-y-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <TabsList className="grid grid-cols-4 w-full bg-transparent h-12 p-1 gap-1">
            <TabsTrigger value="movimientos" className="gap-1.5 text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <PackagePlus className="w-3.5 h-3.5" />Movimientos
            </TabsTrigger>
            <TabsTrigger value="bodegas" className="gap-1.5 text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Warehouse className="w-3.5 h-3.5" />Bodegas
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-1.5 text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5" />Stock Min.
              {alertCount > 0 && <span className="ml-0.5 bg-rose-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold shrink-0">{alertCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="reporte" className="gap-1.5 text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <BarChart3 className="w-3.5 h-3.5" />Reporte
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ══ TAB: Movimientos ══ */}
        <TabsContent value="movimientos" className="space-y-4 mt-0">
          {/* Register form — collapsible */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setFormCollapsed(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-border hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-foreground">Registrar movimiento</h3>
                  <p className="text-xs text-muted-foreground">Entrada, salida o ajuste de inventario</p>
                </div>
              </div>
              <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', !formCollapsed && 'rotate-90')} />
            </button>
            <div className={cn('transition-all duration-200 overflow-hidden', formCollapsed ? 'max-h-0' : 'max-h-[800px]')}>
            <div className="p-5 space-y-4">
              {/* Type selector — visual buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de movimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  {MOVEMENT_TYPES.map(t => {
                    const Icon = t.icon
                    const isActive = movementType === t.value
                    return (
                      <button key={t.value} type="button" onClick={() => setMovementType(t.value as InventoryMovement['type'])}
                        className={cn('flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all',
                          isActive ? cn(t.color, 'border-current shadow-sm scale-[0.98]') : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}>
                        <Icon className="w-4 h-4" />{t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Fields grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Bodega</label>
                  <Select value={movementWarehouse} onValueChange={setMovementWarehouse}>
                    <SelectTrigger className="bg-secondary border-border h-9"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Material</label>
                  <Select value={movementMaterial} onValueChange={setMovementMaterial} disabled={!movementWarehouse}>
                    <SelectTrigger className="bg-secondary border-border h-9"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {materialsForMovement.length === 0
                        ? <div className="p-2 text-xs text-muted-foreground">Sin materiales.</div>
                        : materialsForMovement.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Cantidad</label>
                  <Input type="number" value={movementQuantity} onChange={e => setMovementQuantity(e.target.value)} className="bg-secondary border-border h-9" placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Unidad</label>
                  <Input value={movementUnit} onChange={e => setMovementUnit(e.target.value)} className="bg-secondary border-border h-9" placeholder="kg, caja..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                  <Input type="date" value={movementDate} onChange={e => setMovementDate(e.target.value)} className="bg-secondary border-border h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Costo CLP <span className="text-muted-foreground/60 font-normal">(opcional)</span></label>
                  <Input type="number" value={movementCost} onChange={e => setMovementCost(e.target.value)} className="bg-secondary border-border h-9" placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Responsable</label>
                  <Input value={movementResponsible} onChange={e => setMovementResponsible(e.target.value)} className="bg-secondary border-border h-9" placeholder="Nombre" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Observacion</label>
                  <Input value={movementObservation} onChange={e => setMovementObservation(e.target.value)} className="bg-secondary border-border h-9" placeholder="Detalle..." />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={handleAddMovement} disabled={saving} className="gap-2 px-6">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Registrar movimiento
                </Button>
              </div>
            </div>
            </div>
          </div>

          {/* Movements table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold text-foreground">Historial de movimientos</h3>
                <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-semibold tabular-nums">{filteredMovements.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input value={movSearch} onChange={e => { setMovSearch(e.target.value); setMovPage(0) }} placeholder="Buscar material, bodega..." className="pl-8 h-8 text-xs bg-secondary border-border w-48" />
                </div>
                <Select value={movTypeFilter} onValueChange={v => { setMovTypeFilter(v); setMovPage(0) }}>
                  <SelectTrigger className="h-8 text-xs bg-secondary border-border w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={movWarehouseFilter} onValueChange={v => { setMovWarehouseFilter(v); setMovPage(0) }}>
                  <SelectTrigger className="h-8 text-xs bg-secondary border-border w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las bodegas</SelectItem>
                    {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pagedMovements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <PackagePlus className="w-5 h-5 text-muted-foreground opacity-50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{movements.length === 0 ? 'Sin movimientos' : 'Sin resultados'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{movements.length === 0 ? 'Registra el primer movimiento arriba.' : 'Prueba con otros filtros.'}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-secondary/60 backdrop-blur-sm">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">#</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Fecha</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bodega</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Material</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cantidad</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Costo</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Responsable</th>
                      <th className="w-20 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMovements.map((mov, idx) => {
                      const clp = mov.cost === null ? null : Number(mov.cost)
                      const usd = clp !== null && Number.isFinite(parsedUsdRate) && parsedUsdRate > 0 ? clp / parsedUsdRate : null
                      const rowNum = movPage * PAGE_SIZE + idx + 1
                      return (
                        <tr key={mov.id} className={cn(
                          'border-b border-border/50 hover:bg-primary/5 transition-colors group',
                          idx % 2 === 1 && 'bg-secondary/20'
                        )}>
                          <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground/50 font-medium w-8">{rowNum}</td>
                          <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground font-medium whitespace-nowrap">{mov.movement_date}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">{warehouseNameMap.get(mov.warehouse_id) ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground leading-none">{materialNameMap.get(mov.material_id) ?? '—'}</p>
                              {mov.observation && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[140px]" title={mov.observation}>{mov.observation}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3"><MovementBadge type={mov.type} /></td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn('text-sm font-bold tabular-nums',
                              mov.type === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' :
                              mov.type === 'salida'  ? 'text-rose-600 dark:text-rose-400' :
                              'text-amber-600 dark:text-amber-400'
                            )}>
                              {mov.type === 'entrada' ? '+' : mov.type === 'salida' ? '−' : '±'}{mov.quantity}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{mov.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {clp === null ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div>
                                <p className="text-xs font-semibold text-foreground tabular-nums">{formatClp(clp)}</p>
                                {usd && <p className="text-[10px] text-muted-foreground tabular-nums">{formatUsd(usd)}</p>}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{mov.responsible || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => openEditMovement(mov)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleteTarget({ type: 'movement', id: mov.id, label: `${mov.movement_date} • ${materialNameMap.get(mov.material_id) ?? 'Material'}` }); setShowDeleteDialog(true) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={movPage} total={filteredMovements.length} onChange={p => { setMovPage(p) }} />
          </div>
        </TabsContent>

        {/* ══ TAB: Bodegas y Materiales ══ */}
        <TabsContent value="bodegas" className="space-y-4 mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Warehouses */}
            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Warehouse className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Bodegas</h3>
                  <p className="text-xs text-muted-foreground">{warehouses.length} registradas</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-border/60">
                {warehouses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <Warehouse className="w-6 h-6 text-muted-foreground opacity-40" />
                    <p className="text-xs text-muted-foreground">Sin bodegas. Crea la primera.</p>
                  </div>
                ) : warehouses.map(w => {
                  const matCount = materials.filter(m => m.warehouse_id === w.id).length
                  return (
                    <div key={w.id} className={cn('flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors group', selectedWarehouseId === w.id && 'bg-primary/5 border-l-2 border-l-primary')}>
                      <button className="flex-1 text-left" onClick={() => setSelectedWarehouseId(w.id === selectedWarehouseId ? '' : w.id)}>
                        <p className="text-sm font-semibold text-foreground">{w.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{w.location || 'Sin ubicacion'} · {matCount} {matCount === 1 ? 'material' : 'materiales'}</p>
                      </button>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => openEditWarehouse(w)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleteTarget({ type: 'warehouse', id: w.id, label: w.name }); setShowDeleteDialog(true) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-border p-4 space-y-3 bg-secondary/20">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nueva bodega</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={warehouseName} onChange={e => setWarehouseName(e.target.value)} placeholder="Nombre" className="bg-secondary border-border text-sm h-9" />
                  <Input value={warehouseLocation} onChange={e => setWarehouseLocation(e.target.value)} placeholder="Ubicacion (opcional)" className="bg-secondary border-border text-sm h-9" />
                </div>
                <Button size="sm" onClick={handleAddWarehouse} disabled={saving} className="gap-1.5 h-8 w-full">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Crear bodega
                </Button>
              </div>
            </div>

            {/* Materials */}
            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Package className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Materiales</h3>
                  <p className="text-xs text-muted-foreground">{materials.length} registrados</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-border/60">
                {materials.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <Package className="w-6 h-6 text-muted-foreground opacity-40" />
                    <p className="text-xs text-muted-foreground">Sin materiales. Crea uno.</p>
                  </div>
                ) : materials.map(m => {
                  const stock = stockMap.get(`${m.warehouse_id}:${m.id}`) ?? 0
                  const minQ = minLevelMap.get(`${m.warehouse_id}:${m.id}`) ?? null
                  const isLow = minQ !== null && stock <= minQ
                  const pct = minQ && minQ > 0 ? Math.min(100, Math.max(0, (stock / (minQ * 2)) * 100)) : null
                  return (
                    <div key={m.id} className={cn('px-4 py-3 hover:bg-secondary/40 transition-colors group', isLow && 'bg-rose-500/5')}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                            {isLow && <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{warehouseNameMap.get(m.warehouse_id) ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <div className="text-right">
                            <p className={cn('text-sm font-bold tabular-nums', isLow ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400')}>{stock}</p>
                            <p className="text-[10px] text-muted-foreground">{m.unit}{minQ !== null ? ` / min ${minQ}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => openEditMaterial(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleteTarget({ type: 'material', id: m.id, label: m.name }); setShowDeleteDialog(true) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                      {pct !== null && (
                        <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', isLow ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-border p-4 space-y-3 bg-secondary/20">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nuevo material</p>
                <Select value={materialWarehouse} onValueChange={setMaterialWarehouse}>
                  <SelectTrigger className="bg-secondary border-border text-sm h-9"><SelectValue placeholder="Bodega" /></SelectTrigger>
                  <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={materialName} onChange={e => setMaterialName(e.target.value)} placeholder="Nombre" className="bg-secondary border-border text-sm h-9" />
                  <Input value={materialUnit} onChange={e => setMaterialUnit(e.target.value)} placeholder="Unidad (kg, caja...)" className="bg-secondary border-border text-sm h-9" />
                </div>
                <Button size="sm" onClick={handleAddMaterial} disabled={saving} className="gap-1.5 h-8 w-full">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Crear material
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ══ TAB: Stock Minimo ══ */}
        <TabsContent value="stock" className="space-y-4 mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Niveles de stock minimo</h3>
                  <p className="text-xs text-muted-foreground">Alertas automaticas cuando el stock baja del umbral</p>
                </div>
              </div>
              {alertCount > 0 && (
                <span className="text-xs bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-full font-semibold">
                  {alertCount} critico{alertCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="p-4 space-y-4">
              {/* Add form */}
              <div className="grid gap-3 sm:grid-cols-3 p-4 bg-secondary/30 rounded-xl border border-dashed border-border">
                <Select value={minWarehouse} onValueChange={setMinWarehouse}>
                  <SelectTrigger className="bg-card border-border text-sm h-9"><SelectValue placeholder="Bodega" /></SelectTrigger>
                  <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={minMaterial} onValueChange={setMinMaterial} disabled={!minWarehouse}>
                  <SelectTrigger className="bg-card border-border text-sm h-9"><SelectValue placeholder="Material" /></SelectTrigger>
                  <SelectContent>
                    {materialsForMinLevel.length === 0 ? <div className="p-2 text-xs text-muted-foreground">Sin materiales.</div> : materialsForMinLevel.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input type="number" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} placeholder="Cantidad minima" className="bg-card border-border text-sm h-9 flex-1" />
                  <Button size="sm" onClick={handleSaveMinLevel} disabled={saving} className="h-9 gap-1 shrink-0 px-4">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Guardar
                  </Button>
                </div>
              </div>

              {minLevels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-muted-foreground opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Sin niveles configurados</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Agrega umbrales de stock minimo arriba.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-secondary/60 backdrop-blur-sm border-b border-border">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bodega</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Material</th>
                          <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nivel minimo</th>
                          <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[180px]">Stock actual</th>
                          <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                          <th className="w-20 px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedMinLevels.map((level, idx) => {
                          const stock = stockMap.get(`${level.warehouse_id}:${level.material_id}`) ?? 0
                          const isLow = stock <= level.min_quantity
                          const pct = level.min_quantity > 0 ? Math.min(100, Math.max(0, (stock / (level.min_quantity * 2)) * 100)) : 50
                          const rowNum = minPage * PAGE_SIZE + idx + 1
                          return (
                            <tr key={level.id} className={cn(
                              'border-b border-border/50 hover:bg-primary/5 transition-colors group',
                              isLow ? 'bg-rose-500/5' : idx % 2 === 1 && 'bg-secondary/20'
                            )}>
                              <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground/50 font-medium w-8">{rowNum}</td>
                              <td className="px-4 py-3 text-xs font-medium text-muted-foreground">
                                <span className="bg-secondary px-2 py-0.5 rounded-md">{warehouseNameMap.get(level.warehouse_id) ?? '—'}</span>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-foreground">{materialNameMap.get(level.material_id) ?? '—'}</td>
                              <td className="px-4 py-3 text-center tabular-nums font-semibold text-muted-foreground">{level.min_quantity}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                                    <div className={cn('h-full rounded-full transition-all duration-500', isLow ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className={cn('text-sm font-bold tabular-nums w-10 text-right shrink-0', isLow ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400')}>{stock}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isLow
                                  ? <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 border border-rose-500/30 dark:text-rose-400 font-semibold"><AlertTriangle className="w-3 h-3" />Critico</span>
                                  : <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 dark:text-emerald-400 font-semibold"><TrendingUp className="w-3 h-3" />OK</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => openEditMinLevel(level)}><Pencil className="w-3.5 h-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleteTarget({ type: 'minlevel', id: level.id, label: `${warehouseNameMap.get(level.warehouse_id) ?? 'Bodega'} • ${materialNameMap.get(level.material_id) ?? 'Material'}` }); setShowDeleteDialog(true) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={minPage} total={minLevels.length} onChange={setMinPage} />
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══ TAB: Reporte ══ */}
        <TabsContent value="reporte" className="space-y-4 mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Reporte por bodega</h3>
                <p className="text-xs text-muted-foreground">Resumen de movimientos y costos en el rango seleccionado</p>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 p-4 bg-secondary/30 rounded-xl border border-dashed border-border">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Desde</label>
                  <Input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className="bg-card border-border text-sm h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Hasta</label>
                  <Input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="bg-card border-border text-sm h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tasa USD (CLP)</label>
                  <Input type="number" value={usdRate} onChange={e => setUsdRate(e.target.value)} placeholder="900" className="bg-card border-border text-sm h-9" />
                </div>
              </div>

              {reportRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-muted-foreground opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Sin movimientos en el rango</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Ajusta las fechas de consulta.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-secondary/60 backdrop-blur-sm border-b border-border">
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bodega</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Entradas</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Salidas</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Ajustes</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Stock final</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Costo prom.</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((row, idx) => {
                        const usd = row.avgCost !== null && Number.isFinite(parsedUsdRate) && parsedUsdRate > 0 ? row.avgCost / parsedUsdRate : null
                        return (
                          <tr key={row.warehouseId} className={cn('border-b border-border/50 hover:bg-primary/5 transition-colors', idx % 2 === 1 && 'bg-secondary/20')}>
                            <td className="px-4 py-3 font-semibold text-foreground">{row.warehouseName}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">+{row.entradas}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400 font-bold">−{row.salidas}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400 font-bold">{row.ajustes}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">{row.stockFinal}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">{row.avgCost === null ? '—' : formatClp(row.avgCost)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">{usd === null ? '—' : formatUsd(usd)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* Totals row */}
                    <tfoot>
                      <tr className="bg-primary/5 border-t-2 border-primary/20">
                        <td className="px-4 py-3 text-xs font-bold text-foreground uppercase tracking-wider">Total</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-bold text-sm">+{reportTotals.entradas}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400 font-bold text-sm">−{reportTotals.salidas}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400 font-bold text-sm">{reportTotals.ajustes}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground text-sm">{reportTotals.stockFinal}</td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Edit Dialogs ─── */}
      <Dialog open={!!editingWarehouse} onOpenChange={o => !o && setEditingWarehouse(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar bodega</DialogTitle><DialogDescription>Actualiza el nombre o la ubicacion.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <Input value={editWarehouseName} onChange={e => setEditWarehouseName(e.target.value)} placeholder="Nombre" className="bg-secondary border-border" />
            <Input value={editWarehouseLocation} onChange={e => setEditWarehouseLocation(e.target.value)} placeholder="Ubicacion (opcional)" className="bg-secondary border-border" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWarehouse(null)}>Cancelar</Button>
            <Button onClick={handleUpdateWarehouse} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingMaterial} onOpenChange={o => !o && setEditingMaterial(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar material</DialogTitle><DialogDescription>Actualiza bodega, nombre y unidad.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <Select value={editMaterialWarehouse} onValueChange={setEditMaterialWarehouse}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Bodega" /></SelectTrigger>
              <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={editMaterialName} onChange={e => setEditMaterialName(e.target.value)} placeholder="Nombre" className="bg-secondary border-border" />
            <Input value={editMaterialUnit} onChange={e => setEditMaterialUnit(e.target.value)} placeholder="Unidad" className="bg-secondary border-border" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMaterial(null)}>Cancelar</Button>
            <Button onClick={handleUpdateMaterial} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingMovement} onOpenChange={o => !o && setEditingMovement(null)}>
        <DialogContent className="bg-card border-border sm:max-w-2xl">
          <DialogHeader><DialogTitle>Editar movimiento</DialogTitle><DialogDescription>Actualiza los datos del movimiento.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Bodega', el: <Select value={editMovementWarehouse} onValueChange={setEditMovementWarehouse}><SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select> },
              { label: 'Material', el: <Select value={editMovementMaterial} onValueChange={setEditMovementMaterial} disabled={!editMovementWarehouse}><SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent>{materialsForEditMovement.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select> },
              { label: 'Tipo', el: <Select value={editMovementType} onValueChange={v => setEditMovementType(v as InventoryMovement['type'])}><SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent>{MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select> },
              { label: 'Cantidad', el: <Input type="number" value={editMovementQuantity} onChange={e => setEditMovementQuantity(e.target.value)} className="bg-secondary border-border" /> },
              { label: 'Unidad', el: <Input value={editMovementUnit} onChange={e => setEditMovementUnit(e.target.value)} className="bg-secondary border-border" /> },
              { label: 'Costo CLP', el: <Input type="number" value={editMovementCost} onChange={e => setEditMovementCost(e.target.value)} className="bg-secondary border-border" placeholder="Opcional" /> },
              { label: 'Responsable', el: <Input value={editMovementResponsible} onChange={e => setEditMovementResponsible(e.target.value)} className="bg-secondary border-border" /> },
              { label: 'Fecha', el: <Input type="date" value={editMovementDate} onChange={e => setEditMovementDate(e.target.value)} className="bg-secondary border-border" /> },
            ].map(f => (
              <div key={f.label} className="space-y-1"><label className="text-xs text-muted-foreground font-medium">{f.label}</label>{f.el}</div>
            ))}
            <div className="space-y-1 sm:col-span-3">
              <label className="text-xs text-muted-foreground font-medium">Observacion</label>
              <Input value={editMovementObservation} onChange={e => setEditMovementObservation(e.target.value)} className="bg-secondary border-border" placeholder="Detalle..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMovement(null)}>Cancelar</Button>
            <Button onClick={handleUpdateMovement} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingMinLevel} onOpenChange={o => !o && setEditingMinLevel(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar nivel minimo</DialogTitle><DialogDescription>Actualiza el minimo de stock.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <Select value={editMinWarehouse} onValueChange={setEditMinWarehouse}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Bodega" /></SelectTrigger>
              <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={editMinMaterial} onValueChange={setEditMinMaterial} disabled={!editMinWarehouse}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Material" /></SelectTrigger>
              <SelectContent>{materialsForEditMinLevel.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" value={editMinQuantity} onChange={e => setEditMinQuantity(e.target.value)} placeholder="Cantidad minima" className="bg-secondary border-border" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMinLevel(null)}>Cancelar</Button>
            <Button onClick={handleUpdateMinLevel} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registro</AlertDialogTitle>
            <AlertDialogDescription>Esta accion no se puede deshacer. Se eliminara permanentemente <strong>{deleteTarget?.label}</strong>.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
