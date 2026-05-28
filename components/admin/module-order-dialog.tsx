'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ArrowDown, ArrowUp, ListOrdered } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface ModuleRow {
  id: string
  name: string
  icon: string
}

interface AccessRow {
  user_id: string
  module_id: string
  enabled: boolean
  display_order: number | null
}

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
}

interface ModuleOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserRow | null
  modules: ModuleRow[]
  accessRows: AccessRow[]
  onOrderSaved: () => void
}

export function ModuleOrderDialog({
  open,
  onOpenChange,
  user,
  modules,
  accessRows,
  onOrderSaved,
}: ModuleOrderDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)

  const orderedModules = useMemo(() => {
    if (!user) return []
    const accessByModule = new Map(
      accessRows
        .filter((row) => row.user_id === user.id)
        .map((row) => [row.module_id, row])
    )

    return modules
      .map((mod) => ({
        module: mod,
        access: accessByModule.get(mod.id),
      }))
      .filter((item) => item.access?.enabled)
      .sort((a, b) => {
        const orderA = a.access?.display_order ?? 0
        const orderB = b.access?.display_order ?? 0
        if (orderA !== orderB) return orderA - orderB
        return a.module.name.localeCompare(b.module.name)
      })
  }, [accessRows, modules, user])

  const swapOrder = async (index: number, direction: 'up' | 'down') => {
    if (!user) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const current = orderedModules[index]
    const target = orderedModules[targetIndex]
    if (!current?.access || !target?.access) return

    setSaving(true)
    const updates = [
      {
        user_id: user.id,
        module_id: current.module.id,
        enabled: current.access.enabled,
        display_order: target.access.display_order ?? 0,
        updated_at: new Date().toISOString(),
      },
      {
        user_id: user.id,
        module_id: target.module.id,
        enabled: target.access.enabled,
        display_order: current.access.display_order ?? 0,
        updated_at: new Date().toISOString(),
      },
    ]

    const { error } = await supabase
      .from('user_module_access')
      .upsert(updates, { onConflict: 'user_id,module_id' })

    setSaving(false)

    if (error) {
      toast.error('No se pudo cambiar el orden', { description: error.message })
      return
    }

    onOrderSaved()
  }

  const userLabel = user?.full_name || user?.email || 'cliente'

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <ListOrdered className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-foreground">
                Orden de modulos
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Reordena los modulos visibles para {userLabel}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          {orderedModules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este usuario no tiene modulos habilitados.
            </p>
          ) : (
            orderedModules.map((item, index) => (
              <div
                key={item.module.id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2"
              >
                <span className="text-sm text-foreground">
                  {item.module.name}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving || index === 0}
                    onClick={() => swapOrder(index, 'up')}
                    className="h-8 w-8 p-0 border-border"
                    aria-label="Mover arriba"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving || index === orderedModules.length - 1}
                    onClick={() => swapOrder(index, 'down')}
                    className="h-8 w-8 p-0 border-border"
                    aria-label="Mover abajo"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
