import { isCostosGastosModule, isProduccionModule } from '@/lib/dashboard/costos-module'
import { isHarvestPlanModule } from '@/lib/dashboard/harvest-plan-module'

/** Maps a module slug/name to its dedicated app route (when one exists). */
export function resolveModuleHref(slug: string, name?: string | null): string {
  if (isCostosGastosModule(slug, name)) {
    return '/dashboard/costos-y-gastos/clasificacion'
  }
  if (isProduccionModule(slug, name)) {
    return '/dashboard/produccion'
  }
  if (isHarvestPlanModule(slug, name)) {
    return '/dashboard/plan-de-cosecha'
  }
  return `/dashboard/${slug}`
}

export function isModuleRouteActive(
  pathname: string,
  slug: string,
  name?: string | null,
): boolean {
  if (isCostosGastosModule(slug, name)) {
    return pathname.startsWith('/dashboard/costos-y-gastos')
  }
  if (isProduccionModule(slug, name)) {
    return (
      pathname === '/dashboard/produccion'
      || pathname === `/dashboard/${slug}`
      || pathname.startsWith(`/dashboard/${slug}/`)
    )
  }
  if (isHarvestPlanModule(slug, name)) {
    return (
      pathname === '/dashboard/plan-de-cosecha'
      || pathname === `/dashboard/${slug}`
      || pathname.startsWith(`/dashboard/${slug}/`)
    )
  }
  return pathname === `/dashboard/${slug}` || pathname.startsWith(`/dashboard/${slug}/`)
}
