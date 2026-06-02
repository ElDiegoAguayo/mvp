const PROVEEDORES_SLUG = 'proveedores'

export function isProveedoresModule(slug: string, name?: string | null): boolean {
  const s = slug.toLowerCase()
  const n = (name ?? '').toLowerCase()
  return (
    s === PROVEEDORES_SLUG
    || s.includes('proveedor')
    || s.includes('supplier')
    || n.includes('proveedor')
    || n.includes('supplier')
  )
}

export const PROVEEDORES_DEFAULT_HREF = '/dashboard/proveedores/empresas'
