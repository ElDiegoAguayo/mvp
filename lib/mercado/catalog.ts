import type { Locale } from '@/lib/i18n/config'
import { localeToBcp47 } from '@/lib/i18n/config'
import { mercado as esMercado } from '@/lib/i18n/messages/partials/es/mercado'

export type FruitKey = keyof typeof esMercado.fruits
export type CountryKey = keyof typeof esMercado.countries
export type PortKey = keyof typeof esMercado.ports
export type CurrencyCode = keyof typeof esMercado.currencies

export const FRUIT_VARIETIES: Record<FruitKey, readonly string[]> = {
  cerezas: ['Bing', 'Santina', 'Lapins', 'Regina', 'Sweetheart', 'Kordia'],
  uvasDeMesa: ['Red Globe', 'Thompson Seedless', 'Crimson Seedless', 'Autumn Royal', 'Sweet Celebration'],
  arandanos: ['Duke', 'Legacy', 'Brigitta', 'Emerald', 'Bluecrop'],
  manzanas: ['Royal Gala', 'Granny Smith', 'Fuji', 'Pink Lady', 'Red Delicious'],
  paltas: ['Hass', 'Edranol', 'Fuerte'],
  ciruelas: ["D'Agen", 'Angeleno', 'Friar'],
  kiwis: ['Hayward', 'Jintao (Amarillo)'],
}

export const FRUIT_KEYS = Object.keys(FRUIT_VARIETIES) as FruitKey[]

export const COUNTRY_PORTS: Record<CountryKey, readonly PortKey[]> = {
  china: ['shanghai', 'guangzhou', 'shenzhen', 'ningboZhoushan'],
  estadosUnidos: ['philadelphia', 'losAngeles', 'longBeach', 'miami', 'savannah'],
  paisesBajos: ['rotterdam'],
  espana: ['valencia', 'barcelona', 'algeciras'],
  japon: ['tokyo', 'yokohama', 'kobe'],
  coreaDelSur: ['busan', 'incheon'],
  brasil: ['santos', 'paranagua'],
  colombia: ['cartagena', 'buenaventura'],
}

export const COUNTRY_KEYS = Object.keys(COUNTRY_PORTS) as CountryKey[]

export const COUNTRY_MULTIPLIERS: Record<CountryKey, number> = {
  china: 1.15,
  estadosUnidos: 1.05,
  paisesBajos: 1.08,
  espana: 1.06,
  japon: 1.12,
  coreaDelSur: 1.10,
  brasil: 0.95,
  colombia: 0.92,
}

export const CURRENCY_CODES = Object.keys(esMercado.currencies) as CurrencyCode[]

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function getFruitLabel(t: TranslateFn, key: FruitKey): string {
  return t(`mercado.fruits.${key}`)
}

export function getCountryLabel(t: TranslateFn, key: CountryKey): string {
  return t(`mercado.countries.${key}`)
}

export function getPortLabel(t: TranslateFn, key: PortKey): string {
  return t(`mercado.ports.${key}`)
}

export function getVarietyLabel(t: TranslateFn, variety: string): string {
  if (variety === 'Jintao (Amarillo)') {
    return t('mercado.varieties.jintaoAmarillo')
  }
  return variety
}

/** Spanish label for PortMap coordinate lookup (PORT_DATA keys are lowercase ES names). */
export function getPortMapLookupLabel(portKey: PortKey): string {
  return esMercado.ports[portKey]
}

export function getCurrencyLabel(t: TranslateFn, code: CurrencyCode): string {
  return t(`mercado.currencies.${code}`)
}

export function formatMercadoDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(localeToBcp47(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatMercadoNewsDate(dateString: string, locale: Locale): string {
  if (!dateString) return ''
  try {
    const safeString = dateString.replace(' ', 'T')
    const date = new Date(safeString)
    if (isNaN(date.getTime())) return dateString
    return formatMercadoDate(date, locale)
  } catch {
    return dateString
  }
}

export function getRelativeTime(
  minutesAgo: number,
  t: TranslateFn,
): string {
  if (minutesAgo < 60) {
    return t('mercado.relativeTime.minutes', { count: minutesAgo })
  }
  const hoursAgo = Math.floor(minutesAgo / 60)
  if (hoursAgo < 24) {
    return t('mercado.relativeTime.hours', { count: hoursAgo })
  }
  const daysAgo = Math.floor(minutesAgo / (60 * 24))
  return t('mercado.relativeTime.days', { count: daysAgo })
}
