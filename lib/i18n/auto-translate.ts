import type { Locale } from './config'
import { toLocalizedText, type LocalizedText } from './localized-text'

const LANG_PAIR: Record<string, string> = {
  'es|en': 'es|en',
  'en|es': 'en|es',
}

/** Machine-translate plain text (server-side only). */
export async function autoTranslateText(
  text: string,
  from: Locale = 'es',
  to: Locale = 'en',
): Promise<string> {
  const input = text.trim()
  if (!input || from === to) return input

  const deeplKey = process.env.DEEPL_API_KEY
  if (deeplKey) {
    try {
      const targetLang = to === 'en' ? 'EN' : 'ES'
      const res = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${deeplKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: input,
          source_lang: from.toUpperCase(),
          target_lang: targetLang,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { translations?: Array<{ text?: string }> }
        const translated = data.translations?.[0]?.text?.trim()
        if (translated) return translated
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const pair = LANG_PAIR[`${from}|${to}`] ?? `${from}|${to}`
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(input)}&langpair=${pair}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return input
    const data = (await res.json()) as {
      responseData?: { translatedText?: string }
    }
    const translated = data.responseData?.translatedText?.trim()
    if (translated && translated.toUpperCase() !== input.toUpperCase()) {
      return translated
    }
  } catch {
    /* fall through */
  }

  return input
}

/** Build `{ es, en }` from Spanish source; EN is auto-generated. */
export async function buildLocalizedFromSpanish(esText: string): Promise<LocalizedText> {
  const es = esText.trim()
  if (!es) return { es: '', en: '' }
  const en = await autoTranslateText(es, 'es', 'en')
  return toLocalizedText(es, en)
}

export async function buildLocalizedFields(
  title: string,
  message: string,
): Promise<{ title_i18n: LocalizedText; message_i18n: LocalizedText }> {
  const [title_i18n, message_i18n] = await Promise.all([
    buildLocalizedFromSpanish(title),
    buildLocalizedFromSpanish(message),
  ])
  return { title_i18n, message_i18n }
}
