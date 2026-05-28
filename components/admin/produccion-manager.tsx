'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import {
  Pencil, Trash2, Save, X, ChevronDown, ChevronRight,
  Package, BookOpen, Search, Loader2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  obtenerInventario,
  actualizarMaterial,
  eliminarMaterial,
  obtenerRecetasAdmin,
  eliminarReceta,
  type RecetaAdmin,
} from '@/app/actions/produccion'
import type { InventarioMaterial } from '@/types/produccion'

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('es-CL')

// ─── MaterialRow ──────────────────────────────────────────────────────────────
function MaterialRow({
  mat,
  onUpdate,
  onDelete,
}: {
  mat: InventarioMaterial
  onUpdate: (id: string, campos: { descripcion?: string; stock_actual?: number; unidad_medida?: string }) => Promise<void>
  onDelete: (id: string, nombre: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [desc, setDesc]       = useState(mat.descripcion)
  const [stock, setStock]     = useState(String(mat.stock_actual))
  const [unit, setUnit]       = useState(mat.unidad_medida)
  const [saving, startSave]   = useTransition()

  const handleSave = () => {
    startSave(async () => {
      await onUpdate(mat.id, {
        descripcion:  desc.trim(),
        stock_actual: parseFloat(stock) || 0,
        unidad_medida: unit.trim(),
      })
      setEditing(false)
    })
  }

  const handleCancel = () => {
    setDesc(mat.descripcion)
    setStock(String(mat.stock_actual))
    setUnit(mat.unidad_medida)
    setEditing(false)
  }

  return (
    <tr className="border-t border-white/5 hover:bg-white/[0.02] group">
      {editing ? (
        <>
          <td className="px-3 py-2">
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="h-7 text-xs bg-background"
            />
          </td>
          <td className="px-3 py-2">
            <Input
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              type="number"
              className="h-7 text-xs bg-background w-28"
            />
          </td>
          <td className="px-3 py-2">
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-7 text-xs bg-background w-24"
            />
          </td>
          <td className="px-3 py-2">
            <div className="flex gap-1">
              <Button size="icon" className="h-6 w-6" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancel}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 text-xs text-foreground/90">{mat.descripcion}</td>
          <td className="px-3 py-2 text-xs text-right font-mono">
            <span className={cn(
              'px-1.5 py-0.5 rounded text-xs',
              mat.stock_actual === 0
                ? 'bg-red-900/40 text-red-300'
                : mat.stock_actual < 1000
                  ? 'bg-amber-900/30 text-amber-300'
                  : 'text-foreground/70',
            )}>
              {fmt(mat.stock_actual)}
            </span>
          </td>
          <td className="px-3 py-2 text-xs text-muted-foreground">{mat.unidad_medida}</td>
          <td className="px-3 py-2">
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon" variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(true)}
              >
                <Pencil className="w-3 h-3" />
              </Button>
              <Button
                size="icon" variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(mat.id, mat.descripcion)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </td>
        </>
      )}
    </tr>
  )
}

// ─── RecetaRow ────────────────────────────────────────────────────────────────
function RecetaRow({
  receta,
  onDelete,
}: {
  receta: RecetaAdmin
  onDelete: (id: string, codigo: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-t border-white/5 hover:bg-white/[0.02] group">
        <td className="px-3 py-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-foreground/90 hover:text-foreground"
          >
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            }
            <span className="font-mono font-semibold">{receta.codigo_receta}</span>
          </button>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{receta.variedad ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-right text-muted-foreground">
          {receta.cajas_por_pallet ?? '—'}
        </td>
        <td className="px-3 py-2 text-xs text-right text-muted-foreground">
          {receta.detalles.length}
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon" variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(receta.id, receta.codigo_receta)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </td>
      </tr>

      {expanded && receta.detalles.length > 0 && (
        <tr className="border-t border-white/5 bg-white/[0.015]">
          <td colSpan={5} className="px-6 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground/60">
                  <th className="text-left py-1 pr-4 font-medium">Material</th>
                  <th className="text-right py-1 pr-4 font-medium">Cant. × Caja</th>
                  <th className="text-right py-1 font-medium">Stock actual</th>
                </tr>
              </thead>
              <tbody>
                {receta.detalles.map((d) => (
                  <tr key={d.id} className="border-t border-white/5">
                    <td className="py-1 pr-4 text-foreground/70">{d.descripcion}</td>
                    <td className="py-1 pr-4 text-right font-mono">{d.cantidad_requerida}</td>
                    <td className={cn(
                      'py-1 text-right font-mono',
                      d.stock_actual === 0 ? 'text-red-400' : 'text-foreground/60',
                    )}>
                      {fmt(d.stock_actual)} {d.unidad_medida}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── ProduccionManager ────────────────────────────────────────────────────────
type Tab = 'materiales' | 'recetas'

interface Props {
  clienteId: string
}

export function ProduccionManager({ clienteId }: Props) {
  const [tab, setTab]           = useState<Tab>('materiales')
  const [query, setQuery]       = useState('')
  const [materials, setMaterials] = useState<InventarioMaterial[]>([])
  const [recetas, setRecetas]   = useState<RecetaAdmin[]>([])
  const [loading, setLoading]   = useState(true)
  const [, startTransition]     = useTransition()

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string; tipo: 'material' | 'receta' } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [mRes, rRes] = await Promise.all([
      obtenerInventario(clienteId),
      obtenerRecetasAdmin(clienteId),
    ])
    if (mRes.ok) setMaterials(mRes.data as InventarioMaterial[])
    if (rRes.ok) setRecetas(rRes.data)
    setLoading(false)
  }, [clienteId])

  useEffect(() => { loadData() }, [loadData])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUpdateMaterial = async (
    id: string,
    campos: { descripcion?: string; stock_actual?: number; unidad_medida?: string },
  ) => {
    const res = await actualizarMaterial(id, campos)
    if (res.ok) {
      setMaterials((prev) => prev.map((m) => m.id === id ? { ...m, ...campos } : m))
      toast.success('Material actualizado')
    } else {
      toast.error(res.message)
    }
  }

  const askDelete = (id: string, label: string, tipo: 'material' | 'receta') => {
    setConfirmDelete({ id, label, tipo })
  }

  const confirmDeleteAction = () => {
    if (!confirmDelete) return
    const { id, tipo } = confirmDelete
    setConfirmDelete(null)
    startTransition(async () => {
      if (tipo === 'material') {
        const res = await eliminarMaterial(id)
        if (res.ok) { setMaterials((prev) => prev.filter((m) => m.id !== id)); toast.success('Material eliminado') }
        else toast.error(res.message)
      } else {
        const res = await eliminarReceta(id)
        if (res.ok) { setRecetas((prev) => prev.filter((r) => r.id !== id)); toast.success('Receta eliminada') }
        else toast.error(res.message)
      }
    })
  }

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const q = query.toLowerCase()
  const filteredMats = materials.filter(
    (m) => m.descripcion.toLowerCase().includes(q) || m.codigo_material.toLowerCase().includes(q),
  )
  const filteredRecs = recetas.filter(
    (r) =>
      r.codigo_receta.toLowerCase().includes(q) ||
      (r.variedad ?? '').toLowerCase().includes(q),
  )

  // ── Stats ──────────────────────────────────────────────────────────────────
  const sinStock = materials.filter((m) => m.stock_actual === 0).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    )
  }

  if (!materials.length && !recetas.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
        No hay datos importados aún. Sube el Excel primero.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-muted-foreground">
          <span className="font-semibold text-foreground">{materials.length}</span> materiales
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-muted-foreground">
          <span className="font-semibold text-foreground">{recetas.length}</span> códigos de embalaje
        </span>
        {sinStock > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {sinStock} sin stock
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {(['materiales', 'recetas'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setQuery('') }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'materiales'
              ? <><Package className="w-3.5 h-3.5" /> Materiales ({materials.length})</>
              : <><BookOpen className="w-3.5 h-3.5" /> Códigos de Embalaje ({recetas.length})</>
            }
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder={tab === 'materiales' ? 'Buscar material…' : 'Buscar código o variedad…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        {tab === 'materiales' ? (
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Material</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Stock</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Unidad</th>
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {filteredMats.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">Sin resultados</td></tr>
              ) : (
                filteredMats.map((m) => (
                  <MaterialRow
                    key={m.id}
                    mat={m}
                    onUpdate={handleUpdateMaterial}
                    onDelete={(id, label) => askDelete(id, label, 'material')}
                  />
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Variedad</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cajas/Pallet</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Materiales</th>
                <th className="px-3 py-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {filteredRecs.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">Sin resultados</td></tr>
              ) : (
                filteredRecs.map((r) => (
                  <RecetaRow
                    key={r.id}
                    receta={r}
                    onDelete={(id, codigo) => askDelete(id, codigo, 'receta')}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/15 border border-destructive/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  ¿Eliminar {confirmDelete.tipo === 'material' ? 'material' : 'código'}?
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">{confirmDelete.label}</span>
                  {confirmDelete.tipo === 'material'
                    ? ' — También se quitará de todas las recetas que lo usen.'
                    : ' — Se eliminarán todos sus materiales de BOM asociados.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDeleteAction}>
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
