'use client'

import Link from 'next/link'
import { Building2, Crown, Sparkles, Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SERVICE_PLANS, type ServicePlanId } from '@/lib/subscription-plans'
import {
  SERVICE_PLAN_DESCRIPTIONS,
  SERVICE_PLAN_LABELS,
  SERVICE_PLAN_PRICES,
  SERVICE_PLAN_TIER_BADGE,
} from '@/lib/service-plan-admin'
import { cn } from '@/lib/utils'

const PLAN_ICONS = {
  esencial: Sparkles,
  enterprise: Zap,
  business: Building2,
} as const

const TIER_BADGE_CLASS: Record<ServicePlanId, string> = {
  esencial: 'border-[#b87333]/55 bg-[#fff8f0]/90 text-[#6b3a12]',
  enterprise: 'border-zinc-300/80 bg-white/95 text-zinc-700 dark:border-zinc-500/50 dark:bg-zinc-800/90 dark:text-zinc-100',
  business: 'border-amber-400/55 bg-amber-950/50 text-amber-100',
}

const PLAN_CARD_CLASS: Record<ServicePlanId, string> = {
  esencial:
    'border-[#b87333]/50 bg-gradient-to-br from-[#fce8d4] via-[#e8b88a]/40 to-[#d4956a]/30',
  enterprise:
    'border-zinc-300/70 bg-gradient-to-br from-white via-zinc-100 to-zinc-200/80 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900',
  business:
    'border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50',
}

interface ServicePlansManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ServicePlansManagerDialog({ open, onOpenChange }: ServicePlansManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Planes de servicio Up Crop</DialogTitle>
          <DialogDescription>
            Catálogo oficial de planes. Están definidos en la plataforma y se asignan a cada cliente
            principal desde la tabla de usuarios.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-1">
          {SERVICE_PLANS.map(plan => {
            const Icon = PLAN_ICONS[plan.id]
            const isPremium = plan.id === 'business'
            const isSilver = plan.id === 'enterprise'
            return (
              <div
                key={plan.id}
                className={cn('rounded-xl border p-4 shadow-sm', PLAN_CARD_CLASS[plan.id])}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                      isPremium
                        ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                        : isSilver
                          ? 'border-zinc-300/60 bg-white/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                          : 'border-[#b87333]/50 bg-[#cd7f32]/20 text-[#8b4513]',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={cn(
                          'font-bold',
                          isPremium ? 'text-amber-50' : 'text-foreground',
                        )}
                      >
                        {SERVICE_PLAN_LABELS[plan.id]}
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide',
                          TIER_BADGE_CLASS[plan.id],
                        )}
                      >
                        {SERVICE_PLAN_TIER_BADGE[plan.id]}
                      </Badge>
                      {plan.featured && (
                        <Badge className="bg-[#4A6CF7] text-white hover:bg-[#4A6CF7] text-[10px]">
                          Solución líder
                        </Badge>
                      )}
                      {isPremium && (
                        <Badge className="border-amber-300/60 bg-gradient-to-r from-amber-500/30 to-amber-600/25 text-amber-50 text-[10px] shadow-sm">
                          <Crown className="mr-1 h-3 w-3 text-amber-200" />
                          Premium
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-1 text-sm',
                        isPremium ? 'text-slate-300' : 'text-muted-foreground',
                      )}
                    >
                      {SERVICE_PLAN_DESCRIPTIONS[plan.id]}
                    </p>
                    <p
                      className={cn(
                        'mt-2 text-lg font-bold tabular-nums',
                        isPremium
                          ? 'text-amber-200'
                          : isSilver
                            ? 'text-zinc-800 dark:text-zinc-100'
                            : 'text-[#5c3a1e]',
                      )}
                    >
                      {SERVICE_PLAN_PRICES[plan.id]}
                    </p>
                    <p
                      className={cn(
                        'mt-2 text-[11px]',
                        isPremium ? 'text-slate-400' : 'text-muted-foreground',
                      )}
                    >
                      ID:{' '}
                      <code
                        className={cn(
                          'rounded px-1 py-0.5',
                          isPremium ? 'bg-slate-800/80 text-amber-100/90' : 'bg-secondary',
                        )}
                      >
                        {plan.id}
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Para asignar un plan, usa el botón de corona en cada cliente principal de la tabla de
          usuarios, o el selector dentro del diálogo de asignación.
        </p>
      </DialogContent>
    </Dialog>
  )
}

export function ServicePlansManagerButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      asChild
      className={cn('border-border hover:bg-primary hover:text-primary-foreground hover:border-primary', className)}
    >
      <Link href="/admin/planes-servicio">
        <Crown className="mr-2 h-4 w-4" />
        Planes de servicio
      </Link>
    </Button>
  )
}
