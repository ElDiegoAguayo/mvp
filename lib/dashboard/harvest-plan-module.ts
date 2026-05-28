export const HARVEST_PLAN_MODULE_SLUGS = [
  'plan-de-cosecha',
  'planificacion-produccion',
  'planificacion-de-produccion',
] as const

export function isHarvestPlanModule(
  slug?: string | null,
  name?: string | null,
): boolean {
  const s = (slug ?? '').trim().toLowerCase()
  const n = (name ?? '').trim().toLowerCase()

  if (HARVEST_PLAN_MODULE_SLUGS.includes(s as (typeof HARVEST_PLAN_MODULE_SLUGS)[number])) {
    return true
  }
  if (s.includes('plan-de-cosecha') || s.includes('planificacion')) return true
  if (
    n.includes('plan de cosecha')
    || n.includes('planificación de producción')
    || n.includes('planificacion de produccion')
    || n.includes('planificación de produccion')
  ) {
    return true
  }
  return false
}
