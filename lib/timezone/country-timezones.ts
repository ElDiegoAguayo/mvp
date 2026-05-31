export interface TimezoneRegion {
  label: string
  timezone: string
}

export interface CountryTimezoneInfo {
  flag: string
  nameEs: string
  nameEn: string
  defaultTimezone: string
  regions: TimezoneRegion[]
}

export const COUNTRY_TIMEZONES: Record<string, CountryTimezoneInfo> = {
  Chile: {
    flag: '🇨🇱',
    nameEs: 'Chile',
    nameEn: 'Chile',
    defaultTimezone: 'America/Santiago',
    regions: [
      { label: 'Continental (Santiago, Valparaíso)', timezone: 'America/Santiago' },
      { label: 'Magallanes y Antártica', timezone: 'America/Punta_Arenas' },
      { label: 'Isla de Pascua', timezone: 'Pacific/Easter' },
    ],
  },
  Argentina: {
    flag: '🇦🇷',
    nameEs: 'Argentina',
    nameEn: 'Argentina',
    defaultTimezone: 'America/Argentina/Buenos_Aires',
    regions: [
      { label: 'Buenos Aires, Córdoba, Rosario', timezone: 'America/Argentina/Buenos_Aires' },
      { label: 'Mendoza, San Juan', timezone: 'America/Argentina/Mendoza' },
      { label: 'Salta, Jujuy', timezone: 'America/Argentina/Salta' },
      { label: 'Ushuaia, Tierra del Fuego', timezone: 'America/Argentina/Ushuaia' },
    ],
  },
  Peru: {
    flag: '🇵🇪',
    nameEs: 'Perú',
    nameEn: 'Peru',
    defaultTimezone: 'America/Lima',
    regions: [{ label: 'Todo el país (Lima)', timezone: 'America/Lima' }],
  },
  Colombia: {
    flag: '🇨🇴',
    nameEs: 'Colombia',
    nameEn: 'Colombia',
    defaultTimezone: 'America/Bogota',
    regions: [{ label: 'Todo el país (Bogotá)', timezone: 'America/Bogota' }],
  },
  Mexico: {
    flag: '🇲🇽',
    nameEs: 'México',
    nameEn: 'Mexico',
    defaultTimezone: 'America/Mexico_City',
    regions: [
      { label: 'Centro (CDMX, Guadalajara)', timezone: 'America/Mexico_City' },
      { label: 'Noroeste (Tijuana, Mexicali)', timezone: 'America/Tijuana' },
      { label: 'Sonora', timezone: 'America/Hermosillo' },
      { label: 'Sureste (Cancún, Mérida)', timezone: 'America/Cancun' },
    ],
  },
  Brazil: {
    flag: '🇧🇷',
    nameEs: 'Brasil',
    nameEn: 'Brazil',
    defaultTimezone: 'America/Sao_Paulo',
    regions: [
      { label: 'Brasilia, São Paulo, Río', timezone: 'America/Sao_Paulo' },
      { label: 'Amazonas, Rondônia', timezone: 'America/Manaus' },
      { label: 'Acre', timezone: 'America/Rio_Branco' },
      { label: 'Fernando de Noronha', timezone: 'America/Noronha' },
    ],
  },
  'United States of America': {
    flag: '🇺🇸',
    nameEs: 'Estados Unidos',
    nameEn: 'United States',
    defaultTimezone: 'America/New_York',
    regions: [
      { label: 'Este (Nueva York, Miami)', timezone: 'America/New_York' },
      { label: 'Centro (Chicago, Dallas)', timezone: 'America/Chicago' },
      { label: 'Montaña (Denver, Phoenix)', timezone: 'America/Denver' },
      { label: 'Pacífico (Los Angeles, Seattle)', timezone: 'America/Los_Angeles' },
      { label: 'Alaska', timezone: 'America/Anchorage' },
      { label: 'Hawái', timezone: 'Pacific/Honolulu' },
    ],
  },
  Canada: {
    flag: '🇨🇦',
    nameEs: 'Canadá',
    nameEn: 'Canada',
    defaultTimezone: 'America/Toronto',
    regions: [
      { label: 'Este (Toronto, Montreal)', timezone: 'America/Toronto' },
      { label: 'Centro (Winnipeg)', timezone: 'America/Winnipeg' },
      { label: 'Montaña (Calgary, Edmonton)', timezone: 'America/Edmonton' },
      { label: 'Pacífico (Vancouver)', timezone: 'America/Vancouver' },
      { label: 'Terranova', timezone: 'America/St_Johns' },
    ],
  },
  Spain: {
    flag: '🇪🇸',
    nameEs: 'España',
    nameEn: 'Spain',
    defaultTimezone: 'Europe/Madrid',
    regions: [
      { label: 'Península y Baleares', timezone: 'Europe/Madrid' },
      { label: 'Canarias', timezone: 'Atlantic/Canary' },
    ],
  },
  France: {
    flag: '🇫🇷',
    nameEs: 'Francia',
    nameEn: 'France',
    defaultTimezone: 'Europe/Paris',
    regions: [{ label: 'Metropolitana (París)', timezone: 'Europe/Paris' }],
  },
  Germany: {
    flag: '🇩🇪',
    nameEs: 'Alemania',
    nameEn: 'Germany',
    defaultTimezone: 'Europe/Berlin',
    regions: [{ label: 'Todo el país (Berlín)', timezone: 'Europe/Berlin' }],
  },
  'United Kingdom': {
    flag: '🇬🇧',
    nameEs: 'Reino Unido',
    nameEn: 'United Kingdom',
    defaultTimezone: 'Europe/London',
    regions: [{ label: 'Inglaterra, Gales, Escocia', timezone: 'Europe/London' }],
  },
  China: {
    flag: '🇨🇳',
    nameEs: 'China',
    nameEn: 'China',
    defaultTimezone: 'Asia/Shanghai',
    regions: [{ label: 'Todo el país (Pekín, Shanghai)', timezone: 'Asia/Shanghai' }],
  },
  Japan: {
    flag: '🇯🇵',
    nameEs: 'Japón',
    nameEn: 'Japan',
    defaultTimezone: 'Asia/Tokyo',
    regions: [{ label: 'Todo el país (Tokio)', timezone: 'Asia/Tokyo' }],
  },
  Australia: {
    flag: '🇦🇺',
    nameEs: 'Australia',
    nameEn: 'Australia',
    defaultTimezone: 'Australia/Sydney',
    regions: [
      { label: 'Sydney, Melbourne', timezone: 'Australia/Sydney' },
      { label: 'Brisbane', timezone: 'Australia/Brisbane' },
      { label: 'Adelaide', timezone: 'Australia/Adelaide' },
      { label: 'Perth', timezone: 'Australia/Perth' },
      { label: 'Darwin', timezone: 'Australia/Darwin' },
    ],
  },
  'New Zealand': {
    flag: '🇳🇿',
    nameEs: 'Nueva Zelanda',
    nameEn: 'New Zealand',
    defaultTimezone: 'Pacific/Auckland',
    regions: [
      { label: 'Isla Norte y Sur', timezone: 'Pacific/Auckland' },
      { label: 'Chatham', timezone: 'Pacific/Chatham' },
    ],
  },
  Russia: {
    flag: '🇷🇺',
    nameEs: 'Rusia',
    nameEn: 'Russia',
    defaultTimezone: 'Europe/Moscow',
    regions: [
      { label: 'Moscú, San Petersburgo', timezone: 'Europe/Moscow' },
      { label: 'Ekaterimburgo', timezone: 'Asia/Yekaterinburg' },
      { label: 'Novosibirsk', timezone: 'Asia/Novosibirsk' },
      { label: 'Vladivostok', timezone: 'Asia/Vladivostok' },
      { label: 'Kamchatka', timezone: 'Asia/Kamchatka' },
    ],
  },
  India: {
    flag: '🇮🇳',
    nameEs: 'India',
    nameEn: 'India',
    defaultTimezone: 'Asia/Kolkata',
    regions: [{ label: 'Todo el país (Nueva Delhi)', timezone: 'Asia/Kolkata' }],
  },
  'South Africa': {
    flag: '🇿🇦',
    nameEs: 'Sudáfrica',
    nameEn: 'South Africa',
    defaultTimezone: 'Africa/Johannesburg',
    regions: [{ label: 'Todo el país (Johannesburgo)', timezone: 'Africa/Johannesburg' }],
  },
  Egypt: {
    flag: '🇪🇬',
    nameEs: 'Egipto',
    nameEn: 'Egypt',
    defaultTimezone: 'Africa/Cairo',
    regions: [{ label: 'Todo el país (El Cairo)', timezone: 'Africa/Cairo' }],
  },
  Ecuador: {
    flag: '🇪🇨',
    nameEs: 'Ecuador',
    nameEn: 'Ecuador',
    defaultTimezone: 'America/Guayaquil',
    regions: [
      { label: 'Continental (Quito, Guayaquil)', timezone: 'America/Guayaquil' },
      { label: 'Galápagos', timezone: 'Pacific/Galapagos' },
    ],
  },
  Bolivia: {
    flag: '🇧🇴',
    nameEs: 'Bolivia',
    nameEn: 'Bolivia',
    defaultTimezone: 'America/La_Paz',
    regions: [{ label: 'Todo el país (La Paz)', timezone: 'America/La_Paz' }],
  },
  Paraguay: {
    flag: '🇵🇾',
    nameEs: 'Paraguay',
    nameEn: 'Paraguay',
    defaultTimezone: 'America/Asuncion',
    regions: [{ label: 'Todo el país (Asunción)', timezone: 'America/Asuncion' }],
  },
  Uruguay: {
    flag: '🇺🇾',
    nameEs: 'Uruguay',
    nameEn: 'Uruguay',
    defaultTimezone: 'America/Montevideo',
    regions: [{ label: 'Todo el país (Montevideo)', timezone: 'America/Montevideo' }],
  },
  Venezuela: {
    flag: '🇻🇪',
    nameEs: 'Venezuela',
    nameEn: 'Venezuela',
    defaultTimezone: 'America/Caracas',
    regions: [{ label: 'Todo el país (Caracas)', timezone: 'America/Caracas' }],
  },
}

const SIMPLE_FALLBACK: Record<string, string> = {
  Guatemala: 'America/Guatemala',
  Honduras: 'America/Tegucigalpa',
  'El Salvador': 'America/El_Salvador',
  Nicaragua: 'America/Managua',
  'Costa Rica': 'America/Costa_Rica',
  Panama: 'America/Panama',
  Cuba: 'America/Havana',
  'Dominican Rep.': 'America/Santo_Domingo',
  Haiti: 'America/Port-au-Prince',
  Jamaica: 'America/Jamaica',
  Morocco: 'Africa/Casablanca',
  Nigeria: 'Africa/Lagos',
  Kenya: 'Africa/Nairobi',
  Turkey: 'Europe/Istanbul',
  Poland: 'Europe/Warsaw',
  Sweden: 'Europe/Stockholm',
  Norway: 'Europe/Oslo',
  Switzerland: 'Europe/Zurich',
  Austria: 'Europe/Vienna',
  Belgium: 'Europe/Brussels',
  Ireland: 'Europe/Dublin',
  Greece: 'Europe/Athens',
  Thailand: 'Asia/Bangkok',
  Vietnam: 'Asia/Ho_Chi_Minh',
  Indonesia: 'Asia/Jakarta',
  Malaysia: 'Asia/Kuala_Lumpur',
  Singapore: 'Asia/Singapore',
  Philippines: 'Asia/Manila',
  Taiwan: 'Asia/Taipei',
  Israel: 'Asia/Jerusalem',
  'Saudi Arabia': 'Asia/Riyadh',
  Qatar: 'Asia/Qatar',
  Portugal: 'Europe/Lisbon',
  Italy: 'Europe/Rome',
  Netherlands: 'Europe/Amsterdam',
  'United Arab Emirates': 'Asia/Dubai',
  'South Korea': 'Asia/Seoul',
}

export function resolveCountryTimezone(countryNameEn: string): CountryTimezoneInfo {
  const known = COUNTRY_TIMEZONES[countryNameEn]
  if (known) return known

  const tz = SIMPLE_FALLBACK[countryNameEn] ?? 'UTC'
  return {
    flag: '🌍',
    nameEs: countryNameEn,
    nameEn: countryNameEn,
    defaultTimezone: tz,
    regions: [{ label: 'Zona principal', timezone: tz }],
  }
}

export async function resolveTimezoneFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<{ timezone: string; label: string }> {
  try {
    const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${latitude}&longitude=${longitude}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API error')
    const data = (await res.json()) as { timeZone?: string }
    const timezone = data.timeZone ?? 'UTC'
    return { timezone, label: `${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°` }
  } catch {
    return { timezone: 'UTC', label: `${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°` }
  }
}

export function formatTimeInTimezone(
  timezone: string,
  locale = 'es-CL',
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      ...options,
    }).format(new Date())
  } catch {
    return '—'
  }
}

export function formatTimeOnly(timezone: string, locale = 'es-CL'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date())
  } catch {
    return '—'
  }
}

export const SAVED_TIMEZONE_STORAGE_KEY = 'upcrop-admin-saved-timezone'

export interface SavedTimezone {
  countryKey: string
  flag: string
  nameEs: string
  defaultTimezone: string
  regions: TimezoneRegion[]
  savedAt: string
}
