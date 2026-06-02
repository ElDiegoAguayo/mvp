'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deleteSupplierAction,
  listSuppliersAction,
  saveSupplierAction,
} from '@/app/actions/proveedores-actions'
import type { SupplierCompany } from '@/lib/proveedores/types'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

const emptyForm = () => ({
  company_name: '',
  tax_id: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  is_active: true,
})

export function SuppliersManager() {
  const { t } = useLocale()
  const [suppliers, setSuppliers] = useState<SupplierCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listSuppliersAction()
    if (res.ok) setSuppliers(res.data)
    else toast.error(res.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(
      s =>
        s.company_name.toLowerCase().includes(q)
        || s.tax_id.toLowerCase().includes(q)
        || s.contact_name.toLowerCase().includes(q),
    )
  }, [suppliers, search])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = (s: SupplierCompany) => {
    setEditingId(s.id)
    setForm({
      company_name: s.company_name,
      tax_id: s.tax_id,
      contact_name: s.contact_name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      notes: s.notes,
      is_active: s.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.company_name.trim()) {
      toast.error(t('proveedores.common.required'))
      return
    }
    startTransition(async () => {
      const res = await saveSupplierAction({ id: editingId ?? undefined, ...form })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('proveedores.companies.saved'))
      setDialogOpen(false)
      await load()
    })
  }

  const handleDelete = (id: string) => {
    if (!window.confirm(t('proveedores.companies.deleteConfirm'))) return
    startTransition(async () => {
      const res = await deleteSupplierAction(id)
      if (!res.ok) {
        toast.error(res.message ?? 'Error')
        return
      }
      toast.success(t('proveedores.companies.deleted'))
      await load()
    })
  }

  return (
    <>
      <DashboardCard
        header={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('proveedores.companies.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('proveedores.companies.subtitle')}</p>
            </div>
            <Button onClick={openCreate} className="shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              {t('proveedores.companies.add')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('proveedores.companies.search')}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t('proveedores.common.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Building2 className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">{t('proveedores.companies.empty')}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">{t('proveedores.companies.emptyHint')}</p>
              <Button onClick={openCreate} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                {t('proveedores.companies.add')}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('proveedores.companies.fields.companyName')}</TableHead>
                    <TableHead>{t('proveedores.companies.fields.taxId')}</TableHead>
                    <TableHead>{t('proveedores.companies.fields.contactName')}</TableHead>
                    <TableHead>{t('proveedores.companies.fields.email')}</TableHead>
                    <TableHead>{t('proveedores.companies.fields.active')}</TableHead>
                    <TableHead className="text-right">{t('proveedores.common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.company_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.tax_id || '—'}</TableCell>
                      <TableCell>{s.contact_name || '—'}</TableCell>
                      <TableCell>{s.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? 'default' : 'secondary'}>
                          {s.is_active ? t('proveedores.companies.activeYes') : t('proveedores.companies.activeNo')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(s.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DashboardCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('proveedores.companies.edit') : t('proveedores.companies.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="company_name">{t('proveedores.companies.fields.companyName')} *</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tax_id">{t('proveedores.companies.fields.taxId')}</Label>
                <Input
                  id="tax_id"
                  value={form.tax_id}
                  onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact_name">{t('proveedores.companies.fields.contactName')}</Label>
                <Input
                  id="contact_name"
                  value={form.contact_name}
                  onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">{t('proveedores.companies.fields.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">{t('proveedores.companies.fields.phone')}</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">{t('proveedores.companies.fields.address')}</Label>
              <Input
                id="address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">{t('proveedores.companies.fields.notes')}</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="is_active">{t('proveedores.companies.fields.active')}</Label>
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('proveedores.common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('proveedores.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
