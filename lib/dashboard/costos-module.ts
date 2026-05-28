export function isCostosGastosModule(slug?: string | null, name?: string | null): boolean {
  const s = (slug ?? '').trim().toLowerCase()
  const n = (name ?? '').trim().toLowerCase()
  if (
    s === 'costos-y-gastos'
    || s.includes('costos')
    || s.includes('gastos')
    || s.includes('compras')
  ) {
    return true
  }
  if (
    n.includes('costos y gastos')
    || n.includes('costos')
    || n.includes('gastos')
    || n.includes('compras')
  ) {
    return true
  }
  return false
}

export function isProduccionModule(slug?: string | null, name?: string | null): boolean {
  const s = (slug ?? '').trim().toLowerCase()
  const n = (name ?? '').trim().toLowerCase()
  if (s.includes('plan-de-cosecha')) return false
  if (
    s === 'produccion'
    || s.includes('embalaje')
    || s.includes('planificacion-produccion')
  ) {
    return true
  }
  if (
    n.includes('planificación de producción')
    || n.includes('planificacion de produccion')
  ) {
    return true
  }
  if (s.includes('produccion') && !s.includes('cosecha')) return true
  return false
}
