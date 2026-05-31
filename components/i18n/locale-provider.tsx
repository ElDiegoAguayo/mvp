'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  type Locale,
} from '@/lib/i18n/config'
import { translate, translateAreaName, translateModuleName } from '@/lib/i18n/translate'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  tArea: (name: string) => string
  tModule: (slug: string, fallbackName: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (isLocale(stored)) return stored
  const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`))
  if (isLocale(match?.[1])) return match[1]
  const browser = navigator.language.toLowerCase()
  if (browser.startsWith('en')) return 'en'
  return defaultLocale
}

function persistLocale(locale: Locale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`
  document.documentElement.lang = locale
}

interface LocaleProviderProps {
  children: ReactNode
  initialLocale?: Locale
}

export function LocaleProvider({ children, initialLocale = defaultLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    const stored = readStoredLocale()
    setLocaleState(stored)
    document.documentElement.lang = stored
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    persistLocale(next)
  }, [])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      tArea: (name) => translateAreaName(name, locale),
      tModule: (slug, fallbackName) => translateModuleName(slug, fallbackName, locale),
    }),
    [locale, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    return {
      locale: defaultLocale as Locale,
      setLocale: () => {},
      t: (key: string, params?: Record<string, string | number>) =>
        translate(defaultLocale, key, params),
      tArea: (name: string) => translateAreaName(name, defaultLocale),
      tModule: (slug: string, fallback: string) =>
        translateModuleName(slug, fallback, defaultLocale),
    }
  }
  return ctx
}
