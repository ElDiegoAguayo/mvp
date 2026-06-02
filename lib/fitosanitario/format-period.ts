export function formatApplicationDate(iso: string | null, locale: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatApplicationPeriod(
  start: string | null,
  end: string | null,
  locale: string,
  programEnd?: string | null,
): string {
  const from = start ?? null
  const to = end ?? programEnd ?? null

  if (!from && !to) return '—'
  if (!from) return formatApplicationDate(to, locale)
  if (!to || from === to) {
    return `${formatApplicationDate(from, locale)} (${locale === 'en' ? 'single day' : 'mismo día'})`
  }
  return `${formatApplicationDate(from, locale)} – ${formatApplicationDate(to, locale)}`
}
