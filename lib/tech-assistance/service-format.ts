import type { Locale } from '@/lib/i18n/config'
import type { TechAssistanceService, TechAssistanceLocation } from '@/lib/tech-assistance/types'

function formatShortDate(iso: string, locale: Locale): string {
  const localeTag = locale === 'en' ? 'en-US' : 'es-CL'
  return new Date(`${iso}T12:00:00`).toLocaleDateString(localeTag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatServicePeriod(
  service: Pick<TechAssistanceService, 'period_start' | 'period_end'>,
  locale: Locale = 'es',
): string | null {
  if (!service.period_start || !service.period_end) return null
  return `${formatShortDate(service.period_start, locale)} – ${formatShortDate(service.period_end, locale)}`
}

export function serviceLocationDefault(
  service: Pick<TechAssistanceService, 'location_label' | 'location_id'> & {
    tech_assistance_locations?: TechAssistanceLocation | null
  },
): { label: string; locationId: string | null } {
  const joined = service.tech_assistance_locations
  if (joined?.name) {
    return { label: joined.name, locationId: joined.id }
  }
  if (service.location_label?.trim()) {
    return { label: service.location_label.trim(), locationId: service.location_id ?? null }
  }
  return { label: '', locationId: service.location_id ?? null }
}

export function serviceOptionLabel(
  service: Pick<
    TechAssistanceService,
    'name' | 'period_start' | 'period_end' | 'location_label' | 'location_id'
  > & {
    tech_assistance_locations?: TechAssistanceLocation | null
  },
  locale: Locale = 'es',
): string {  const parts = [service.name]
  const period = formatServicePeriod(service, locale)
  if (period) parts.push(period)
  const location = serviceLocationDefault(service)
  if (location.label) parts.push(location.label)
  return parts.join(' · ')
}
