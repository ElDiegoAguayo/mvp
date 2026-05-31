/** Distancia en metros entre dos puntos (fórmula de Haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusM = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isWithinGeofence(
  userLat: number,
  userLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  return distanceMeters(userLat, userLng, centerLat, centerLng) <= radiusMeters
}

export function formatDistanceMeters(meters: number, locale: 'es' | 'en' = 'es'): string {
  if (meters < 1000) {
    const unit = locale === 'en' ? 'm' : 'm'
    return `${Math.round(meters)} ${unit}`
  }
  const km = meters / 1000
  const unit = locale === 'en' ? 'km' : 'km'
  return `${km.toLocaleString(locale === 'en' ? 'en-US' : 'es-CL', { maximumFractionDigits: 1 })} ${unit}`
}

export type GeofenceLocation = {
  id: string
  name: string
  lat: number
  lng: number
  radius_meters: number
}

export function geofenceErrorMessage(
  location: GeofenceLocation,
  userLat: number,
  userLng: number,
  locale: 'es' | 'en' = 'es',
): string {
  const dist = distanceMeters(userLat, userLng, location.lat, location.lng)
  const distLabel = formatDistanceMeters(dist, locale)
  const radiusLabel = formatDistanceMeters(location.radius_meters, locale)
  if (locale === 'en') {
    return `You are ${distLabel} from "${location.name}" (max allowed: ${radiusLabel}). Move closer to check in.`
  }
  return `Estás a ${distLabel} de "${location.name}" (máximo permitido: ${radiusLabel}). Acércate al lugar para marcar.`
}
