'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deletePhytoProductAction,
  listPhytoProductsAction,
  savePhytoProductAction,
} from '@/app/actions/fitosanitario-actions'
import type { PhytoProduct, PhytoProductCategory } from '@/lib/fitosanitario/types'
import { PHYTO_CATEGORY_OPTIONS } from '@/lib/fitosanitario/categories'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { FlaskConical, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { PhytoTablePagination } from '@/components/dashboard/fitosanitario/phyto-table-pagination'
import { PHYTO_PAGE_SIZE } from '@/lib/fitosanitario/constants'
import { usePagination } from '@/hooks/use-pagination'

const CATEGORIES = PHYTO_CATEGORY_OPTIONS

const emptyForm = () => ({
  name: '',
  brand: '',
  supplier_name: '',
  category: 'other' as PhytoProductCategory,
  product_type_label: '',
  target_label: '',
  active_ingredient: '',
  unit: 'L',
  min_stock: '',
  is_active: true,
})

export function PhytoProductsManager() {
  const { t } = useLocale()
  const [rows, setRows] = useState<PhytoProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listPhytoProductsAction()
    if (res.ok) setRows(res.data)
    else toast.error(res.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.name.toLowerCase().includes(q)
      || r.brand.toLowerCase().includes(q)
      || r.supplier_name.toLowerCase().includes(q)
      || r.target_label.toLowerCase().includes(q),
    )
  }, [rows, search])

  const pagination = usePagination(filtered, PHYTO_PAGE_SIZE)

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = (row: PhytoProduct) => {
    setEditingId(row.id)
    setForm({
      name: row.name,
      brand: row.brand,
      supplier_name: row.supplier_name,
      category: row.category,
      product_type_label: row.product_type_label,
      target_label: row.target_label,
      active_ingredient: row.active_ingredient,
      unit: row.unit,
      min_stock: row.min_stock != null ? String(row.min_stock) : '',
      is_active: row.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error(t('fitosanitario.products.name'))
      return
    }
    startTransition(async () => {
      const res = await savePhytoProductAction({
        id: editingId ?? undefined,
        name: form.name,
        brand: form.brand,
        supplier_name: form.supplier_name,
        category: form.category,
        product_type_label: form.product_type_label,
        target_label: form.target_label,
        active_ingredient: form.active_ingredient,
        unit: form.unit,
        min_stock: form.min_stock ? Number(form.min_stock) : null,
        is_active: form.is_active,
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('fitosanitario.products.saved'))
      setDialogOpen(false)
      await load()
    })
  }

  const handleDelete = (id: string) => {
    if (!window.confirm(t('fitosanitario.products.deleteConfirm'))) return
    startTransition(async () => {
      const res = await deletePhytoProductAction(id)
      if (!res.ok) {
        toast.error(res.message ?? 'Error')
        return
      }
      toast.success(t('fitosanitario.products.deleted'))
      await load()
    })
  }

  return (
    <>
      <DashboardCard
        header={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <h2 className="text-lg font-semibold">{t('fitosanitario.products.title')}</h2>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              {t('fitosanitario.products.add')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('fitosanitario.stock.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{t('fitosanitario.products.empty')}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fitosanitario.products.name')}</TableHead>
                  <TableHead>{t('fitosanitario.products.category')}</TableHead>
                  <TableHead>{t('fitosanitario.products.supplier')}</TableHead>
                  <TableHead>{t('fitosanitario.products.target')}</TableHead>
                  <TableHead>{t('fitosanitario.products.unit')}</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      {row.brand && <div className="text-xs text-muted-foreground">{row.brand}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.product_type_label || t(`fitosanitario.categories.${row.category}`)}</Badge>
                    </TableCell>
                    <TableCell>{row.supplier_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[180px] truncate">{row.target_label || '—'}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PhytoTablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setPage}
            />
            </div>
          )}
        </div>
      </DashboardCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('fitosanitario.products.edit') : t('fitosanitario.products.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('fitosanitario.products.name')}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.products.brand')}</Label>
              <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.products.supplier')}</Label>
              <Input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.products.category')}</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as PhytoProductCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{t(`fitosanitario.categories.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.products.productType')}</Label>
              <Input value={form.product_type_label} onChange={e => setForm(f => ({ ...f, product_type_label: e.target.value }))} placeholder="Bioestimulante, Herbicida…" />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.products.unit')}</Label>
              <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('fitosanitario.products.target')}</Label>
              <Input value={form.target_label} onChange={e => setForm(f => ({ ...f, target_label: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('fitosanitario.products.activeIngredient')}</Label>
              <Input value={form.active_ingredient} onChange={e => setForm(f => ({ ...f, active_ingredient: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.products.minStock')}</Label>
              <Input type="number" min={0} step="any" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t('fitosanitario.products.active')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
