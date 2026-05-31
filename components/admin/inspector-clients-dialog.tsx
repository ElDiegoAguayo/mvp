'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  getInspectorClientAssignmentsAction,
  setInspectorClientAssignmentsAction,
} from '@/app/admin/actions'
import { HardHat, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
}

interface ClientOption {
  id: string
  label: string
}

interface InspectorClientsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inspector: UserRow | null
  clients: ClientOption[]
}

export function InspectorClientsDialog({
  open,
  onOpenChange,
  inspector,
  clients,
}: InspectorClientsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const inspectorLabel = inspector?.full_name?.trim() || inspector?.email || 'Inspector'

  useEffect(() => {
    if (!open || !inspector?.id) return
    setLoading(true)
    void getInspectorClientAssignmentsAction(inspector.id).then(res => {
      if (res.ok) setSelected(new Set(res.clientIds))
      else toast.error(res.message)
      setLoading(false)
    })
  }, [open, inspector?.id])

  const toggle = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSave = () => {
    if (!inspector?.id) return
    startTransition(async () => {
      const res = await setInspectorClientAssignmentsAction(inspector.id, [...selected])
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !isPending && onOpenChange(o)}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 border border-sky-500/30">
              <HardHat className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <DialogTitle>Clientes del inspector</DialogTitle>
              <DialogDescription>
                {inspectorLabel} — elige en qué clientes puede marcar asistencia. Si no seleccionas ninguno, verá
                todos los clientes con Asistencia técnica.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-2 py-2 border border-border rounded-lg p-3 bg-secondary/20">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay clientes principales.</p>
          ) : (
            clients.map(c => (
              <label
                key={c.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary/50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={v => toggle(c.id, v === true)}
                  disabled={isPending}
                />
                <span className="text-sm">{c.label}</span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending || loading} className="bg-primary">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
