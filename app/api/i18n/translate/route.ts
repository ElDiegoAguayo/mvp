import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { autoTranslateText } from '@/lib/i18n/auto-translate'
import type { Locale } from '@/lib/i18n/config'

const cache = new Map<string, string>()
const MAX_CACHE = 500

function cacheKey(text: string, from: Locale, to: Locale): string {
  return `${from}|${to}|${text}`
}

function remember(key: string, value: string) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(key, value)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { texts?: string[]; from?: Locale; to?: Locale }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const texts = Array.isArray(body.texts) ? body.texts.slice(0, 20) : []
  const from: Locale = body.from === 'en' ? 'en' : 'es'
  const to: Locale = body.to === 'en' ? 'en' : 'es'

  if (texts.length === 0) {
    return NextResponse.json({ translations: [] })
  }

  if (from === to) {
    return NextResponse.json({ translations: texts })
  }

  const translations = await Promise.all(
    texts.map(async (text) => {
      const input = String(text ?? '')
      if (!input.trim()) return input
      const key = cacheKey(input, from, to)
      const hit = cache.get(key)
      if (hit) return hit
      const translated = await autoTranslateText(input, from, to)
      remember(key, translated)
      return translated
    }),
  )

  return NextResponse.json({ translations })
}
