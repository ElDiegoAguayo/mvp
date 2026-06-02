export interface ParsedDose {
  value: number
  unit: 'L' | 'KG' | 'CC' | 'GR' | 'UN'
  perVolume: number
}

export function parseDoseLabel(label: string): ParsedDose | null {
  const raw = String(label ?? '').trim().toUpperCase()
  if (!raw) return null

  const match = raw.match(/^([\d.,]+)\s*(CC|GR|KG|LT|L|UN)?\s*\/\s*([\d.,]+)/)
  if (!match) return null

  const value = parseLocaleNumber(match[1])
  const perVolume = parseLocaleNumber(match[3])
  if (value == null || perVolume == null || perVolume <= 0) return null

  let unit: ParsedDose['unit'] = 'L'
  const u = (match[2] ?? 'L').replace('LT', 'L')
  if (u === 'CC') unit = 'CC'
  else if (u === 'GR') unit = 'GR'
  else if (u === 'KG') unit = 'KG'
  else if (u === 'UN') unit = 'UN'

  return { value, unit, perVolume }
}

export function parseLocaleNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw).replace(/[^\d.,-]/g, '').trim()
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    return Number(s.replace(/\./g, '').replace(',', '.'))
  }
  if (s.includes(',')) return Number(s.replace(',', '.'))
  return Number(s)
}

export function parseQuantityWithUnit(raw: unknown): { quantity: number; unit: string } | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return { quantity: raw, unit: 'L' }
  const s = String(raw).trim()
  const match = s.match(/^([\d.,\s]+)\s*([A-Za-zÁÉÍÓÚáéíóú]+)?$/)
  if (!match) return null
  const quantity = parseLocaleNumber(match[1])
  if (quantity == null) return null
  const unit = (match[2] ?? 'L').toUpperCase().replace('LT', 'L')
  return { quantity, unit }
}

/** Total product required from dose, spray volume (L/ha) and surface (ha). */
export function calculateApplicationTotal(input: {
  doseLabel: string
  sprayVolumeLHa: number | null
  surfaceHa: number | null
}): { total: number; unit: string } | null {
  const dose = parseDoseLabel(input.doseLabel)
  const spray = input.sprayVolumeLHa ?? 0
  const surface = input.surfaceHa ?? 0
  if (!dose || spray <= 0 || surface <= 0) return null

  const total = (dose.value / 100) * spray * surface / 100
  if (dose.unit === 'CC') return { total, unit: 'L' }
  if (dose.unit === 'GR') return { total, unit: 'KG' }
  if (dose.unit === 'KG') return { total: (dose.value / 100) * spray * surface / 100, unit: 'KG' }
  if (dose.unit === 'UN') return { total: (dose.value / dose.perVolume) * surface, unit: 'UN' }
  return { total, unit: 'L' }
}

export function excelSerialToIso(serial: unknown): string | null {
  if (serial == null || serial === '') return null
  if (typeof serial === 'string' && /^\d{4}-\d{2}-\d{2}/.test(serial)) return serial.slice(0, 10)
  const n = typeof serial === 'number' ? serial : Number(serial)
  if (!Number.isFinite(n) || n < 1) return null
  const utcDays = Math.floor(n - 25569)
  const date = new Date(utcDays * 86400000)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

export function parseCurrency(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(/[^\d.,-]/g, '')
  return parseLocaleNumber(s)
}
