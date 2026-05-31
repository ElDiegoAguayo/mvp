export type GeocodeResult = {
  lat: number
  lng: number
  displayName: string
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', trimmed)

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
