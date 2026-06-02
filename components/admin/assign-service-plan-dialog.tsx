'use client'

import { useEffect, useState, useTransition } from 'react'
import { Crown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateClientServicePlanAction } from '@/app/admin/actions'
import { SERVICE_PLANS, type ServicePlanId } from '@/lib/subscription-plans'
import {
  getServicePlanBadgeClass,
  getServicePlanLabel,
  SERVICE_PLAN_LABELS,
  SERVICE_PLAN_PRICES,
} from '@/lib/service-plan-admin'

export interface AssignServicePlanUser {
  id: string
  full_name: string | null
  email: string | null
  service_plan_id?: ServicePlanId | null
}

interface AssignServicePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AssignServicePlanUser | null
  onSaved?: (userId: string, planId: ServicePlanId | null) => void
}

export function AssignServicePlanDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: AssignServicePlanDialogProps) {
  const [selected, setSelected] = useState<ServicePlanId | 'none'>('none')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (user) {
      setSelected(user.service_plan_id ?? 'none')
    }
  }, [user])

  const handleSave = () => {
    if (!user) return
    const planId = selected === 'none' ? null : selected

    startTransition(async () => {
      const result = await updateClientServicePlanAction(user.id, planId)
      if (result.ok) {
        toast.success('Plan actualizado', { description: result.message })
        onSaved?.(user.id, planId)
        onOpenChange(false)
      } else {
        toast.error('No se pudo asignar el plan', { description: result.message })
      }
    })
  }

  const currentPlanId = user?.service_plan_id ?? null
  const unchanged = selected === 'none' && currentPlanId === null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Crown className="h-5 w-5 text-[#4A6CF7]" />
            Asignar plan de servicio
          </DialogTitle>
          <DialogDescription>
            {user ? (
              <>
                Cliente:{' '}
                <span className="font-medium text-foreground">
                  {user.full_name || user.email || user.id}
                </span>
                . Los subusuarios heredan el plan de la cuenta principal. Al guardar, el plan
                queda activo por 1 mes desde este momento.
              </>
            ) : (
              'Selecciona un cliente principal.'
            )}
          </DialogDescription>
        </DialogHeader>

        {user && (
          <div className="space-y-4 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Plan actual
              </span>
              {currentPlanId ? (
                <Badge variant="outline" className={getServicePlanBadgeClass(currentPlanId)}>
                  {getServicePlanLabel(currentPlanId)}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Sin plan asignado
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Nuevo plan de servicio
              </label>
              <Select
                value={selected}
                onValueChange={v => setSelected(v as ServicePlanId | 'none')}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin plan asignado</SelectItem>
                  {SERVICE_PLANS.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {SERVICE_PLAN_LABELS[plan.id]} — {SERVICE_PLAN_PRICES[plan.id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!user || isPending || unchanged}
            className="bg-[#4A6CF7] hover:bg-[#3a5ce6] text-white"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
