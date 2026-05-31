import type { Locale } from './config'

/** Text stored in two languages (ES source of truth + EN). */
export type LocalizedText = {
  es: string
  en: string
}

export function isLocalizedText(value: unknown): value is LocalizedText {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.es === 'string' && typeof row.en === 'string'
}

/** Pick the string for the active locale; falls back to ES then legacy plain text. */
export function pickLocalized(
  value: LocalizedText | string | null | undefined,
  locale: Locale,
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (locale === 'en' && value.en.trim()) return value.en
  return value.es.trim() || value.en.trim() || ''
}

export function toLocalizedText(es: string, en?: string | null): LocalizedText {
  const trimmedEs = es.trim()
  const trimmedEn = en?.trim()
  return { es: trimmedEs, en: trimmedEn || trimmedEs }
}
