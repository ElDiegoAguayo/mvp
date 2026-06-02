export function isHarvestEstimationModule(slug?: string | null, name?: string | null): boolean {
  const s = (slug ?? '').trim().toLowerCase()
  const n = (name ?? '').trim().toLowerCase()
  if (s === 'estimacion-cosecha' || s.includes('estimacion-cosecha')) return true
  if (n.includes('estimación de cosecha') || n.includes('estimacion de cosecha')) return true
  if (n.includes('estimación cosecha') || n.includes('estimacion cosecha')) return true
  return false
}
