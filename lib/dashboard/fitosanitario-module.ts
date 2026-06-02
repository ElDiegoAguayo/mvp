const FITOSANITARIO_SLUG = 'inventario-fitosanitario'

export function isFitosanitarioModule(slug: string, name?: string | null): boolean {
  const s = slug.toLowerCase()
  const n = (name ?? '').toLowerCase()
  return (
    s === FITOSANITARIO_SLUG
    || s.includes('fitosanitario')
    || n.includes('fitosanitario')
  )
}

export const FITOSANITARIO_DEFAULT_HREF = '/dashboard/inventario-fitosanitario/stock'
