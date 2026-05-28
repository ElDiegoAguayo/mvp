'use client'

import { useEffect, useRef, useState } from 'react'

// Spanish to English country name mapping (for GeoJSON matching)
const COUNTRY_NAME_MAP: Record<string, string> = {
  'chile': 'Chile',
  'argentina': 'Argentina',
  'brasil': 'Brazil',
  'perú': 'Peru',
  'peru': 'Peru',
  'colombia': 'Colombia',
  'méxico': 'Mexico',
  'mexico': 'Mexico',
  'estados unidos': 'United States of America',
  'eeuu': 'United States of America',
  'usa': 'United States of America',
  'canadá': 'Canada',
  'canada': 'Canada',
  'españa': 'Spain',
  'francia': 'France',
  'alemania': 'Germany',
  'italia': 'Italy',
  'reino unido': 'United Kingdom',
  'china': 'China',
  'japón': 'Japan',
  'japon': 'Japan',
  'australia': 'Australia',
  'sudáfrica': 'South Africa',
  'sudafrica': 'South Africa',
  'india': 'India',
  'rusia': 'Russia',
  'países bajos': 'Netherlands',
  'holanda': 'Netherlands',
  'bélgica': 'Belgium',
  'belgica': 'Belgium',
  'suiza': 'Switzerland',
  'portugal': 'Portugal',
  'ecuador': 'Ecuador',
  'bolivia': 'Bolivia',
  'paraguay': 'Paraguay',
  'uruguay': 'Uruguay',
  'venezuela': 'Venezuela',
  'panamá': 'Panama',
  'panama': 'Panama',
  'costa rica': 'Costa Rica',
  'guatemala': 'Guatemala',
  'honduras': 'Honduras',
  'el salvador': 'El Salvador',
  'nicaragua': 'Nicaragua',
  'cuba': 'Cuba',
  'república dominicana': 'Dominican Republic',
  'corea del sur': 'South Korea',
  'corea del norte': 'North Korea',
  'corea': 'South Korea',
  'tailandia': 'Thailand',
  'vietnam': 'Vietnam',
  'indonesia': 'Indonesia',
  'malasia': 'Malaysia',
  'filipinas': 'Philippines',
  'singapur': 'Singapore',
  'nueva zelanda': 'New Zealand',
  'emiratos árabes unidos': 'United Arab Emirates',
  'emiratos arabes unidos': 'United Arab Emirates',
  'arabia saudita': 'Saudi Arabia',
  'israel': 'Israel',
  'turquía': 'Turkey',
  'turquia': 'Turkey',
  'egipto': 'Egypt',
  'marruecos': 'Morocco',
  'nigeria': 'Nigeria',
  'kenia': 'Kenya',
  'taiwán': 'Taiwan',
  'taiwan': 'Taiwan',
  'hong kong': 'Hong Kong',
  'suecia': 'Sweden',
  'noruega': 'Norway',
  'dinamarca': 'Denmark',
  'finlandia': 'Finland',
  'grecia': 'Greece',
  'irlanda': 'Ireland',
  'austria': 'Austria',
  'polonia': 'Poland',
  'república checa': 'Czech Republic',
  'republica checa': 'Czech Republic',
  'etiopía': 'Ethiopia',
  'etiopia': 'Ethiopia',
  'tanzania': 'Tanzania',
  'ghana': 'Ghana',
}

// GeoJSON URL for country boundaries
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

interface SatelliteMapProps {
  countries: string[]
  markerColor?: string
  height?: number
}

export function SatelliteMap({ countries, markerColor = '#4A6CF7', height = 400 }: SatelliteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [L, setL] = useState<typeof import('leaflet') | null>(null)
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null)

  // Dynamic import of Leaflet (only on client)
  useEffect(() => {
    setIsClient(true)
    import('leaflet').then((leaflet) => {
      import('leaflet/dist/leaflet.css')
      setL(leaflet.default)
    })
  }, [])

  // Load GeoJSON data
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setGeoJsonData(data))
      .catch(err => console.error('Error loading GeoJSON:', err))
  }, [])

  // Initialize map
  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 18,
      worldCopyJump: true,
    })

    // Add satellite tile layer (ESRI World Imagery)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18,
    }).addTo(map)

    // Add labels overlay
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 18,
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [L])

  // Update highlighted countries
  useEffect(() => {
    if (!L || !mapInstanceRef.current || !geoJsonData) return

    const map = mapInstanceRef.current

    // Remove existing GeoJSON layer
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current)
      geoJsonLayerRef.current = null
    }

    // Normalize country names from input
    const normalizedCountries = new Set<string>()
    const countryCounts: Record<string, number> = {}
    
    countries.forEach(country => {
      const normalized = country.toLowerCase().trim()
      const englishName = COUNTRY_NAME_MAP[normalized] || country
      normalizedCountries.add(englishName.toLowerCase())
      countryCounts[englishName] = (countryCounts[englishName] || 0) + 1
    })

    if (normalizedCountries.size === 0) return

    // Create GeoJSON layer with highlighted countries
    const highlightedFeatures: GeoJSON.Feature[] = []
    const bounds: L.LatLngBounds[] = []

    geoJsonData.features.forEach(feature => {
      const countryName = feature.properties?.ADMIN || feature.properties?.name || ''
      const isHighlighted = normalizedCountries.has(countryName.toLowerCase())
      
      if (isHighlighted) {
        highlightedFeatures.push(feature)
      }
    })

    if (highlightedFeatures.length > 0) {
      const geoJsonLayer = L.geoJSON(
        { type: 'FeatureCollection', features: highlightedFeatures } as GeoJSON.FeatureCollection,
        {
          style: () => ({
            fillColor: markerColor,
            fillOpacity: 0.5,
            color: markerColor,
            weight: 2,
            opacity: 1,
          }),
          onEachFeature: (feature, layer) => {
            const countryName = feature.properties?.ADMIN || feature.properties?.name || ''
            const count = countryCounts[countryName] || 1
            
            layer.bindPopup(`
              <div style="text-align: center; font-family: system-ui, sans-serif; padding: 4px;">
                <strong style="font-size: 14px;">${countryName}</strong>
                <br/>
                <span style="color: ${markerColor}; font-size: 16px; font-weight: bold;">${count}</span>
                <span style="font-size: 12px; color: #666;"> registro${count !== 1 ? 's' : ''}</span>
              </div>
            `)
            
            // Collect bounds
            if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
              bounds.push(layer.getBounds())
            }
          }
        }
      ).addTo(map)

      geoJsonLayerRef.current = geoJsonLayer

      // Fit map to show all highlighted countries
      if (bounds.length > 0) {
        const combinedBounds = bounds.reduce((acc, b) => acc.extend(b), bounds[0])
        map.fitBounds(combinedBounds, { padding: [30, 30], maxZoom: 4 })
      }
    }
  }, [L, countries, markerColor, geoJsonData])

  if (!isClient || !L) {
    return (
      <div 
        className="w-full bg-secondary/30 rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-muted-foreground">Cargando mapa...</div>
      </div>
    )
  }

  // Get unique country names for legend
  const uniqueCountries = Array.from(new Set(countries.map(c => {
    const normalized = c.toLowerCase().trim()
    return COUNTRY_NAME_MAP[normalized] || c
  })))

  return (
    <div className="w-full rounded-lg overflow-hidden border border-border">
      <div ref={mapRef} style={{ height, width: '100%' }} />
      {uniqueCountries.length > 0 && (
        <div className="bg-card/95 backdrop-blur px-4 py-2 border-t">
          <div className="flex flex-wrap gap-2">
            {uniqueCountries.map(country => (
              <span 
                key={country} 
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${markerColor}20`, color: markerColor }}
              >
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: markerColor }}
                />
                {country}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
