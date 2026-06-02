'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deletePhytoWarehouseAction,
  listHarvestFieldsAction,
  listPhytoWarehousesAction,
  savePhytoWarehouseAction,
} from '@/app/actions/fitosanitario-actions'
import type { HarvestFieldOption, PhytoWarehouse } from '@/lib/fitosanitario/types'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2, Pencil, Plus, Trash2, Warehouse } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { PhytoTablePagination } from '@/components/dashboard/fitosanitario/phyto-table-pagination'
import { PHYTO_PAGE_SIZE } from '@/lib/fitosanitario/constants'
import { usePagination } from '@/hooks/use-pagination'

const emptyForm = () => ({
  field_id: '',
  name: '',
  location: '',
  notes: '',
  is_active: true,
})

export function PhytoWarehousesManager() {
  const { t } = useLocale()
  const [rows, setRows] = useState<PhytoWarehouse[]>([])
  const [fields, setFields] = useState<HarvestFieldOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const [wRes, fRes] = await Promise.all([
      listPhytoWarehousesAction(),
      listHarvestFieldsAction(),
    ])
    if (wRes.ok) setRows(wRes.data)
    else toast.error(wRes.message)
    if (fRes.ok) setFields(fRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = (row: PhytoWarehouse) => {
    setEditingId(row.id)
    setForm({
      field_id: row.field_id ?? '',
      name: row.name,
      location: row.location,
      notes: row.notes,
      is_active: row.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error(t('fitosanitario.warehouses.name'))
      return
    }
    startTransition(async () => {
      const res = await savePhytoWarehouseAction({
        id: editingId ?? undefined,
        field_id: form.field_id || null,
        name: form.name,
        location: form.location,
        notes: form.notes,
        is_active: form.is_active,
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('fitosanitario.warehouses.saved'))
      setDialogOpen(false)
      await load()
    })
  }

  const handleDelete = (id: string) => {
    if (!window.confirm(t('fitosanitario.warehouses.deleteConfirm'))) return
    startTransition(async () => {
      const res = await deletePhytoWarehouseAction(id)
      if (!res.ok) {
        toast.error(res.message ?? 'Error')
        return
      }
      toast.success(t('fitosanitario.warehouses.deleted'))
      await load()
    })
  }

  const pagination = usePagination(rows, PHYTO_PAGE_SIZE)

  return (
    <>
      <DashboardCard
        header={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <h2 className="text-lg font-semibold">{t('fitosanitario.warehouses.title')}</h2>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              {t('fitosanitario.warehouses.add')}
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{t('fitosanitario.warehouses.empty')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fitosanitario.warehouses.name')}</TableHead>
                <TableHead>{t('fitosanitario.warehouses.field')}</TableHead>
                <TableHead>{t('fitosanitario.warehouses.location')}</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.field?.name ?? t('fitosanitario.warehouses.noField')}</TableCell>
                  <TableCell className="text-muted-foreground">{row.location || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={row.is_active ? 'default' : 'secondary'}>
                      {row.is_active ? t('fitosanitario.warehouses.active') : 'Inactiva'}
                    </Badge>
                  </TableCell>
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
      </DashboardCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('fitosanitario.warehouses.edit') : t('fitosanitario.warehouses.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('fitosanitario.warehouses.field')}</Label>
              <Select value={form.field_id || '__none'} onValueChange={v => setForm(f => ({ ...f, field_id: v === '__none' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('fitosanitario.warehouses.fieldPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t('fitosanitario.warehouses.noField')}</SelectItem>
                  {fields.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.warehouses.name')}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.warehouses.location')}</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('fitosanitario.warehouses.notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t('fitosanitario.warehouses.active')}</Label>
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
