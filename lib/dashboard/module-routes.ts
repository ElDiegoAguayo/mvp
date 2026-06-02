import { isCostosGastosModule, isProduccionModule } from '@/lib/dashboard/costos-module'
import { isFitosanitarioModule, FITOSANITARIO_DEFAULT_HREF } from '@/lib/dashboard/fitosanitario-module'
import { isProveedoresModule, PROVEEDORES_DEFAULT_HREF } from '@/lib/dashboard/proveedores-module'

/** Maps a module slug/name to its dedicated app route (when one exists). */
export function resolveModuleHref(slug: string, name?: string | null): string {
  if (slug === 'inicio') {
    return '/dashboard'
  }
  if (isCostosGastosModule(slug, name)) {
    return '/dashboard/costos-y-gastos/clasificacion'
  }
  if (isProduccionModule(slug, name)) {
    return '/dashboard/produccion'
  }
  if (isProveedoresModule(slug, name)) {
    return PROVEEDORES_DEFAULT_HREF
  }
  if (isFitosanitarioModule(slug, name)) {
    return FITOSANITARIO_DEFAULT_HREF
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
  if (isProveedoresModule(slug, name)) {
    return pathname.startsWith('/dashboard/proveedores')
  }
  if (isFitosanitarioModule(slug, name)) {
    return pathname.startsWith('/dashboard/inventario-fitosanitario')
  }
  return pathname === `/dashboard/${slug}` || pathname.startsWith(`/dashboard/${slug}/`)
}
