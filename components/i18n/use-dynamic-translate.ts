'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '@/components/i18n/locale-provider'
import type { Locale } from '@/lib/i18n/config'

const STORAGE_PREFIX = 'upcrop-dt:'

function storageKey(locale: Locale, texts: string[]): string {
  return `${STORAGE_PREFIX}${locale}:${texts.join('\u001e')}`
}

async function fetchTranslations(
  texts: string[],
  from: Locale,
  to: Locale,
): Promise<string[]> {
  const res = await fetch('/api/i18n/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, from, to }),
  })
  if (!res.ok) return texts
  const data = (await res.json()) as { translations?: string[] }
  return data.translations ?? texts
}

/**
 * Translates dynamic strings (API feeds, user content) when locale is EN.
 * Caches results in sessionStorage to avoid repeat API calls.
 */
export function useDynamicTranslate(texts: string[], enabled = true): {
  texts: string[]
  loading: boolean
} {
  const { locale } = useLocale()
  const stableKey = useMemo(() => texts.join('\u001e'), [texts])
  const [translated, setTranslated] = useState<string[]>(texts)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setTranslated(texts)
  }, [stableKey, texts])

  useEffect(() => {
    if (!enabled || locale === 'es' || texts.length === 0) {
      setTranslated(texts)
      setLoading(false)
      return
    }

    let cancelled = false
    const cacheId = storageKey(locale, texts)

    try {
      const cached = sessionStorage.getItem(cacheId)
      if (cached) {
        const parsed = JSON.parse(cached) as string[]
        if (Array.isArray(parsed) && parsed.length === texts.length) {
          setTranslated(parsed)
          return
        }
      }
    } catch {
      /* ignore */
    }

    setLoading(true)
    void fetchTranslations(texts, 'es', 'en').then((result) => {
      if (cancelled) return
      setTranslated(result)
      setLoading(false)
      try {
        sessionStorage.setItem(cacheId, JSON.stringify(result))
      } catch {
        /* ignore quota */
      }
    })

    return () => {
      cancelled = true
    }
  }, [enabled, locale, stableKey, texts])

  return { texts: locale === 'es' ? texts : translated, loading }
}
