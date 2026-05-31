export const LOCALE_COOKIE = 'upcrop-locale'
export const LOCALE_STORAGE_KEY = 'upcrop-locale'

export const locales = ['es', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'es'

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'es' || value === 'en'
}

export function localeToBcp47(locale: Locale): string {
  return locale === 'en' ? 'en-US' : 'es-CL'
}
