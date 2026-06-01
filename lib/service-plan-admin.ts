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

/** Color del nombre de usuario según plan contratado (sidebar, perfil, etc.). */
export function getServicePlanNameClass(id: ServicePlanId | null | undefined): string {
  switch (id) {
    case 'esencial':
      return 'text-[#8b4513] dark:text-[#d4956a]'
    case 'enterprise':
      return 'bg-[linear-gradient(180deg,#27272a_0%,#52525b_45%,#a1a1aa_55%,#3f3f46_100%)] bg-clip-text text-transparent'
    case 'business':
      return 'bg-[linear-gradient(180deg,#b45309_0%,#f59e0b_50%,#fbbf24_100%)] bg-clip-text text-transparent'
    default:
      return 'text-foreground'
  }
}

/** Contenedor del isotipo Up Crop según plan (sidebar, badges, etc.). */
export function getServicePlanMarkClass(id: ServicePlanId | null | undefined): string {
  switch (id) {
    case 'esencial':
      return [
        'border-[#6b3a12]/70',
        'bg-[linear-gradient(145deg,#f0c898_0%,#cd7f32_40%,#b87333_70%,#7a4518_100%)]',
        'shadow-[0_2px_8px_rgba(101,52,14,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]',
      ].join(' ')
    case 'enterprise':
      return [
        'border-white/70 dark:border-zinc-400/50',
        'bg-[linear-gradient(155deg,#ffffff_0%,#e4e4e7_35%,#a1a1aa_70%,#52525b_100%)]',
        'shadow-[0_2px_8px_rgba(82,82,91,0.35),inset_0_1px_0_rgba(255,255,255,0.85)]',
      ].join(' ')
    case 'business':
      return [
        'border-amber-300/60',
        'bg-[linear-gradient(145deg,#fde68a_0%,#f59e0b_45%,#b45309_100%)]',
        'shadow-[0_2px_10px_rgba(180,83,9,0.4),inset_0_1px_0_rgba(255,255,255,0.45)]',
      ].join(' ')
    default:
      return 'border-primary/25 bg-primary/10 shadow-sm'
  }
}
