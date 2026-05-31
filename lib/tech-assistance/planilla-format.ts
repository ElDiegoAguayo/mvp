import {
  TECH_ASSISTANCE_IVA_RATE,
  formatCLP,
  type TechAssistanceEntry,
  type TechBillingUnit,
  type TranslateFn,
} from '@/lib/tech-assistance/types'
import type { Locale } from '@/lib/i18n/config'
import type { CellValue } from '@/lib/excel/upcrop-excel-theme'

const PLANILLA_HEADER_KEYS = [
  'technicianName',
  'date',
  'service',
  'location',
  'attendance',
  'checkIn',
  'checkOut',
  'regularHours',
  'overtimeHours',
  'billingUnit',
  'quantity',
  'serviceCost',
  'iva',
  'serviceCostWithIva',
  'total',
] as const

/** Price column indices (0-based) hidden when showPrices is false */
export const PLANILLA_PRICE_COLUMN_INDICES = [11, 12, 13, 14]

/** Columnas numéricas (1-based) para formato Excel */
export const PLANILLA_NUMERIC_COLUMNS = [5, 8, 9, 11, 12, 13, 14, 15]

export const PLANILLA_COLUMN_WIDTHS = [
  22, 12, 22, 18, 10, 11, 11, 12, 12, 12, 14, 14, 12, 18, 14,
]

export function getPlanillaHeaders(t: TranslateFn): string[] {
  return PLANILLA_HEADER_KEYS.map(key => t(`asistenciaTecnica.planilla.headers.${key}`))
}

export function formatEntryTime(
  iso: string | null | undefined,
  locale: Locale = 'es',
): string {
  if (!iso) return ''
  const localeTag = locale === 'en' ? 'en-US' : 'es-CL'
  return new Date(iso).toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
}

export function billingUnitShort(unit: TechBillingUnit, locale: Locale = 'es'): string {
  if (unit === 'hectare') return 'ha'
  return locale === 'en' ? 'day' : 'día'
}

export function entryLocationDisplay(entry: TechAssistanceEntry): string {
  if (entry.location_label?.trim()) return entry.location_label.trim()
  if (entry.check_in_lat != null) {
    return `${Number(entry.check_in_lat).toFixed(5)}, ${Number(entry.check_in_lng).toFixed(5)}`
  }
  return ''
}

export function entryUnitAmounts(unitPriceNet: number) {
  const unitNet = Number(unitPriceNet) || 0
  const unitIva = Math.round(unitNet * TECH_ASSISTANCE_IVA_RATE * 100) / 100
  const unitWithIva = Math.round((unitNet + unitIva) * 100) / 100
  return { unitNet, unitIva, unitWithIva }
}

export function entryToPlanillaRow(entry: TechAssistanceEntry, locale: Locale = 'es'): CellValue[] {
  const { unitNet, unitIva, unitWithIva } = entryUnitAmounts(entry.unit_price_net)
  const qty = Number(entry.quantity) || 0

  return [
    entry.inspector_name,
    entry.work_date,
    entry.tech_assistance_services?.name ?? '',
    entryLocationDisplay(entry),
    Number(entry.attendance_value ?? 1),
    formatEntryTime(entry.started_at, locale),
    formatEntryTime(entry.ended_at, locale),
    entry.regular_hours != null ? Number(entry.regular_hours) : '',
    entry.overtime_hours != null ? Number(entry.overtime_hours) : '',
    billingUnitShort(entry.billing_unit, locale),
    qty > 0 ? qty : '',
    unitNet > 0 ? unitNet : '',
    unitNet > 0 ? unitIva : '',
    unitNet > 0 ? unitWithIva : '',
    qty > 0 ? Number(entry.amount_total) : '',
  ]
}

export function entriesToPlanillaRows(
  entries: TechAssistanceEntry[],
  locale: Locale = 'es',
): CellValue[][] {
  return entries.map(entry => entryToPlanillaRow(entry, locale))
}

export function getPlanillaSummary(entries: TechAssistanceEntry[], t: TranslateFn): string {
  const subtotal = entries.reduce((s, e) => s + Number(e.amount_net), 0)
  const iva = entries.reduce((s, e) => s + Number(e.amount_iva), 0)
  const total = entries.reduce((s, e) => s + Number(e.amount_total), 0)
  return t('asistenciaTecnica.planilla.summary', {
    count: entries.length,
    net: formatCLP(subtotal),
    iva: formatCLP(iva),
    total: formatCLP(total),
  })
}
