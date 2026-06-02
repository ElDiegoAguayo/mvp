import type { PhytoProductCategory } from '@/lib/fitosanitario/types'

/** Rejects supplier names or junk accidentally stored in Excel "Tipo de Producto". */
export function sanitizeProductTypeLabel(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  if (/\b(s\.?\s*a\.?|spa|limitada|ltda)\b/i.test(lower)) return ''
  if (/^(coagra|vitra|gtm|green has|cals|mart[ií]nez)/i.test(lower)) return ''
  return t
}

export function tipoToCategory(tipo: string): PhytoProductCategory {
  const cleaned = sanitizeProductTypeLabel(tipo)
  const t = cleaned.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  if (!t) return 'other'

  if (t.includes('fung') && (t.includes('insect') || t.includes('acaric'))) return 'fungicide'
  if (t.includes('fung') && t.includes('bacter')) return 'fungicide'
  if (t.includes('insect') && t.includes('acaric')) return 'insecticide'

  if (t.includes('herbic')) return 'herbicide'
  if (t.includes('insect')) return 'insecticide'
  if (t.includes('acaric')) return 'acaricide'
  if (t.includes('fung')) return 'fungicide'
  if (t.includes('molusqu')) return 'insecticide'
  if (t.includes('bacteric')) return 'fungicide'
  if (t.includes('nematic')) return 'insecticide'
  if (t.includes('rodent')) return 'insecticide'

  if (t.includes('fertil') || t.includes('carenc')) return 'fertilizer'
  if (t.includes('bioestim') || t.includes('biopromotor')) return 'biostimulant'
  if (t.includes('semilla')) return 'seed'
  if (t.includes('fitorreg') || t.includes('regulador')) return 'regulator'

  if (t.includes('aceite') && t.includes('mineral')) return 'adjuvant'
  if (t.includes('corrector') && t.includes('ph')) return 'adjuvant'
  if (
    t.includes('adher')
    || t.includes('coadyuv')
    || t.includes('adjuv')
    || t.includes('adyuv')
  ) return 'adjuvant'

  return 'other'
}

export function categoryFromProductTypeLabel(label: string): PhytoProductCategory {
  return tipoToCategory(label)
}

export const PHYTO_CATEGORY_OPTIONS: PhytoProductCategory[] = [
  'herbicide',
  'insecticide',
  'fungicide',
  'fertilizer',
  'adjuvant',
  'biostimulant',
  'seed',
  'regulator',
  'acaricide',
  'other',
]
