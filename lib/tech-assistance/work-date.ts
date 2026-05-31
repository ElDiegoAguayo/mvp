const DEFAULT_WORK_TIMEZONE = 'America/Santiago'

/** Fecha laboral YYYY-MM-DD en zona horaria del negocio (Chile continental). */
export function todayWorkDateISO(timeZone = DEFAULT_WORK_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatWorkDateLabel(isoDate: string, locale: 'es' | 'en' = 'es'): string {
  const localeTag = locale === 'en' ? 'en-US' : 'es-CL'
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(localeTag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
