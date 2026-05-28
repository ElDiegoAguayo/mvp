export const HARVEST_PLAN_MODULE_SLUGS = [
  'plan-de-cosecha',
] as const

const PRODUCCION_SLUG_MARKERS = [
  'produccion',
  'planificacion-produccion',
  'embalaje',
  'planning',
]

export function isHarvestPlanModule(
  slug?: string | null,
  name?: string | null,
): boolean {
  const s = (slug ?? '').trim().toLowerCase()
  const n = (name ?? '').trim().toLowerCase()

  if (PRODUCCION_SLUG_MARKERS.some((marker) => s.includes(marker))) {
    return false
  }

  if (HARVEST_PLAN_MODULE_SLUGS.includes(s as (typeof HARVEST_PLAN_MODULE_SLUGS)[number])) {
    return true
  }
  if (s.includes('plan-de-cosecha')) return true
  if (n.includes('plan de cosecha')) return true
  return false
}
