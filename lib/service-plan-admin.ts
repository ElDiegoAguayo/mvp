import type { ServicePlanId } from '@/lib/subscription-plans'

export const SERVICE_PLAN_LABELS: Record<ServicePlanId, string> = {
  esencial: 'Plan Esencial',
  enterprise: 'Plan Enterprise',
  business: 'Plan Business',
}

export const SERVICE_PLAN_PRICES: Record<ServicePlanId, string> = {
  esencial: '12.5 UF / mes',
  enterprise: '18.5 UF / mes',
  business: 'A medida',
}

export const SERVICE_PLAN_DESCRIPTIONS: Record<ServicePlanId, string> = {
  esencial: 'Para operaciones que dan el primer paso a la digitalización.',
  enterprise: 'El estándar de la industria para operaciones que ya escalaron.',
  business: 'Infraestructura corporativa para holdings y agroindustrias.',
}

export const SERVICE_PLAN_TIER_BADGE: Record<ServicePlanId, string> = {
  esencial: 'Bronce',
  enterprise: 'Plata',
  business: 'Premium',
}

export function getServicePlanLabel(id: ServicePlanId | null | undefined): string {
  if (!id) return 'Sin plan'
  return SERVICE_PLAN_LABELS[id]
}

export function getServicePlanBadgeClass(id: ServicePlanId): string {
  switch (id) {
    case 'esencial':
      return 'bg-[#cd7f32]/15 text-[#8b4513] border-[#b87333]/40'
    case 'enterprise':
      return 'bg-zinc-200/80 text-zinc-800 border-zinc-300/70 dark:bg-zinc-700/40 dark:text-zinc-100 dark:border-zinc-500/50'
    case 'business':
      return 'bg-amber-500/15 text-amber-800 border-amber-500/40 dark:text-amber-200'
  }
}
