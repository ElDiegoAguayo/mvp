import type { Locale } from './config'
import { messages, type Messages } from './messages'

type Path = string

function getByPath(obj: Record<string, unknown>, path: Path): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    return value !== undefined ? String(value) : `{${key}}`
  })
}

export function translate(
  locale: Locale,
  key: Path,
  params?: Record<string, string | number>,
): string {
  const value = getByPath(messages[locale] as unknown as Record<string, unknown>, key)
  if (typeof value === 'string') return interpolate(value, params)
  return key
}

export function translateAreaName(name: string, locale: Locale): string {
  const areas = messages[locale].areas as Record<string, string>
  return areas[name] ?? name
}

export function translateModuleName(
  slug: string,
  fallbackName: string,
  locale: Locale,
): string {
  const mods = messages[locale].modules as Record<string, string>
  return mods[slug] ?? fallbackName
}

export function translateStorageFilesLabel(locale: Locale, count: number): string {
  if (count === 1) return translate(locale, 'storage.files_one')
  return translate(locale, 'storage.files_other', { count })
}

export function translateStoragePlanLabel(
  planId: string,
  locale: Locale,
  fallback?: string,
): string {
  const key = `storage.plans.${planId}`
  const value = getByPath(messages[locale] as unknown as Record<string, unknown>, key)
  if (typeof value === 'string') return value
  return fallback ?? planId
}

export function translateClientStorageModule(
  moduleId: string,
  locale: Locale,
  fallback?: string,
): string {
  const key = `storage.clientModules.${moduleId}`
  const value = getByPath(messages[locale] as unknown as Record<string, unknown>, key)
  if (typeof value === 'string') return value
  return fallback ?? moduleId
}

export function translateCurrencyName(code: string, locale: Locale): string {
  const key = `homeWidgets.currencies.${code}`
  const value = getByPath(messages[locale] as unknown as Record<string, unknown>, key)
  if (typeof value === 'string') return value
  return code
}
