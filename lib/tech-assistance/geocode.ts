export type GeocodeResult = {
  lat: number
  lng: number
  displayName: string
}

function getGoogleMapsApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
}

async function geocodeWithGoogle(query: string, apiKey: string): Promise<GeocodeResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', query)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('language', 'es')

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } })
  if (!res.ok) return null

  const data = (await res.json()) as {
    status: string
    results?: Array<{
      formatted_address: string
      geometry: { location: { lat: number; lng: number } }
    }>
  }

  if (data.status !== 'OK' || !data.results?.[0]) return null

  const hit = data.results[0]
  const lat = Number(hit.geometry.location.lat)
  const lng = Number(hit.geometry.location.lng)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  return { lat, lng, displayName: hit.formatted_address }
}

async function geocodeWithNominatim(query: string): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', query)

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'es',
      'User-Agent': 'UpCrop-MVP/1.0 (tech-assistance)',
    },
    next: { revalidate: 86400 },
  })

  if (!res.ok) return null

  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
  const hit = data[0]
  if (!hit) return null

  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  return { lat, lng, displayName: hit.display_name }
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const googleKey = getGoogleMapsApiKey()
  if (googleKey) {
    const googleHit = await geocodeWithGoogle(trimmed, googleKey)
    if (googleHit) return googleHit
  }

  return geocodeWithNominatim(trimmed)
}
