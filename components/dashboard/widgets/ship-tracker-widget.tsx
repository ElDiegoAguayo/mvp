'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Loader2, AlertCircle, Navigation } from 'lucide-react'

// Solución para que los íconos de Leaflet se vean correctamente en Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface ShipData {
  name: string
  lat?: number
  lng?: number
  status: string
}

const SHIPPING_LINE_OPTIONS = [
  { label: 'MAERSK', value: 'MAERSK' },
  { label: 'MSC', value: 'MSC' },
  { label: 'CMA CGM', value: 'CMA_CGM' },
  { label: 'HAPAG-LLOYD', value: 'HAPAG_LLOYD' },
  { label: 'HMM', value: 'HMM' },
  { label: 'EVERGREEN', value: 'EVERGREEN' },
  { label: 'COSCO', value: 'COSCO' },
  { label: 'ONE', value: 'ONE' },
  { label: 'ZIM', value: 'ZIM' },
  { label: 'YANG MING', value: 'YANG_MING' },
  { label: 'PIL', value: 'PIL' },
]

const CONTAINER_PATTERN = /^[A-Za-z]{4}\d{7}$/

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return null
    const json = await res.json()
    if (Array.isArray(json) && json.length > 0) {
      const first = json[0]
      const lat = Number(first.lat)
      const lng = Number(first.lon)
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng }
    }
    return null
  } catch (err) {
    console.warn('geocode error', err)
    return null
  }
}

export function ShipTrackerWidget({ moduleId, moduleSlug }: { moduleId?: string, moduleSlug?: string }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [shippingLine, setShippingLine] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [shipData, setShipData] = useState<ShipData | null>(null)
  const [isMapFlying, setIsMapFlying] = useState(false)

  const normalizedTerm = searchTerm.trim().toUpperCase()
  const isContainerSearch = CONTAINER_PATTERN.test(normalizedTerm)

  const normalizeShipData = (data: any): ShipData => {
    const latValue = data?.lat ?? data?.latitude ?? data?.position?.lat
    const lngValue = data?.lng ?? data?.longitude ?? data?.position?.lng

    const lat = typeof latValue === 'string' ? Number(latValue) : latValue
    const lng = typeof lngValue === 'string' ? Number(lngValue) : lngValue

    return {
      name:
        data?.name ??
        data?.vesselName ??
        data?.containerName ??
        data?.container?.name ??
        data?.imo ??
        searchTerm,
      status:
        data?.status ??
        data?.state ??
        data?.containerStatus ??
        data?.container?.status ??
        'Sin estado',
      ...(typeof lat === 'number' && !Number.isNaN(lat) ? { lat } : {}),
      ...(typeof lng === 'number' && !Number.isNaN(lng) ? { lng } : {}),
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setIsLoading(true)
    setError('')

    try {
      // Hacemos la petición a tu propio servidor (que de fondo usa tus tokens de JsonCargo)
      const searchParams = new URLSearchParams({ query: searchTerm })
      if (shippingLine.trim() && isContainerSearch) {
        searchParams.set('shipping_line', shippingLine.trim())
      }
      const response = await fetch(`/api/ship-tracking?${searchParams.toString()}`)
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      const payload = isJson ? await response.json() : await response.text()

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No se encontro el contenedor o IMO solicitado.')
        }
        if (!isJson) {
          throw new Error('La API devolvio una respuesta no valida.')
        }
        const errorMessage = (() => {
          if (typeof payload === 'object' && payload !== null && 'error' in payload) {
            const errorValue = (payload as { error?: unknown }).error
            if (typeof errorValue === 'string') return errorValue
            if (errorValue && typeof errorValue === 'object') {
              if ('message' in errorValue && typeof (errorValue as { message?: unknown }).message === 'string') {
                return (errorValue as { message: string }).message
              }
              try {
                return JSON.stringify(errorValue)
              } catch {
                return 'Error al buscar el contenedor en la red satelital'
              }
            }
          }
          if (response.status === 500) {
            return 'Error interno al consultar la API de rastreo.'
          }
          return 'Error al buscar el contenedor en la red satelital'
        })()
        throw new Error(errorMessage)
      }

      if (!isJson) {
        throw new Error('La API devolvio una respuesta no valida.')
      }

      setShipData(normalizeShipData(payload))
      setIsMapFlying(true)

      // If API didn't return coordinates but returned a textual location in the status,
      // try to geocode the textual location (e.g. "SENDAI, MIYAGI") using Nominatim.
      const normalized = normalizeShipData(payload)
      if ((normalized.lat === undefined || normalized.lng === undefined) && typeof normalized.status === 'string') {
        // Try to extract a location-like substring from status
        const statusText = normalized.status
        // Heuristic: look for "Ultima ubicacion:" or common separators
        const locMatch = statusText.match(/ultima ubicacion[:\s]*([^,\n]+)/i) || statusText.match(/location[:\s]*([^,\n]+)/i)
        const fallback = statusText
        const locationToGeocode = locMatch ? locMatch[1].trim() : fallback
        if (locationToGeocode) {
          try {
            const geo = await geocodeLocation(locationToGeocode)
            if (geo) {
              setShipData(prev => prev ? { ...prev, lat: geo.lat, lng: geo.lng } : { name: searchTerm, status: normalized.status, lat: geo.lat, lng: geo.lng })
              setIsMapFlying(true)
            }
          } catch (err) {
            // silently ignore geocoding failures
            console.warn('Geocoding failed:', err)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión desconocido')
      setShipData(null)
      setIsMapFlying(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full overflow-hidden border border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            Rastreo Satelital Global
            <Badge variant="default" className="text-xs bg-blue-600 hover:bg-blue-700">JsonCargo API</Badge>
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Ingresa el número de contenedor o IMO para localizarlo en tiempo real.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Buscador */}
        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ej: MEDU9091004"
              className="flex-1 bg-background"
            />
            <Button type="submit" disabled={isLoading || !searchTerm.trim()} className="bg-primary text-primary-foreground">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Localizar
            </Button>
          </div>
          {isContainerSearch && (
            <div className="grid gap-2 md:grid-cols-[220px_1fr]">
              <Select value={shippingLine} onValueChange={setShippingLine}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Naviera (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {SHIPPING_LINE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={shippingLine}
                onChange={(e) => setShippingLine(e.target.value)}
                placeholder="Escribe el nombre exacto de la naviera"
                className="bg-background"
              />
            </div>
          )}
        </form>

        {/* Mensaje de Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Detalles del Barco/Contenedor */}
        {shipData && (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm flex flex-col md:flex-row md:items-center gap-4">
            <div><span className="text-muted-foreground">ID:</span> <strong className="ml-1">{shipData.name}</strong></div>
            <div>
              <span className="text-muted-foreground">Status:</span> 
              <span className="ml-1 text-emerald-500 font-medium">{shipData.status}</span>
            </div>
            {typeof shipData.lat === 'number' && typeof shipData.lng === 'number' && (
              <div>
                <span className="text-muted-foreground">Coordenadas:</span> 
                <span className="ml-1 font-mono">{shipData.lat.toFixed(4)}, {shipData.lng.toFixed(4)}</span>
              </div>
            )}
          </div>
        )}

        {/* Mapa */}
        <div className="rounded-lg border border-border overflow-hidden h-[360px] relative z-0">
          <MapContainer
            // Si no hay barco, centramos la cámara en el océano Atlántico para que se vea el mundo
            center={shipData?.lat !== undefined && shipData?.lng !== undefined ? [shipData.lat, shipData.lng] : [20, -40]} 
            zoom={shipData?.lat !== undefined && shipData?.lng !== undefined ? 8 : 3}
            className="h-full w-full"
            style={{ background: '#0f172a' }} // Color oscuro para el fondo del océano
          >
            {/* Usamos un mapa oscuro (CartoDB Dark Matter) para que combine con el Dashboard */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {shipData && shipData.lat !== undefined && shipData.lng !== undefined && (
              <>
                <Marker position={[shipData.lat, shipData.lng]}>
                  <Popup className="text-foreground">
                    <div className="text-sm min-w-[200px]">
                      <strong className="text-base">{shipData.name}</strong>
                      <div className="mt-2 text-muted-foreground">{shipData.status}</div>
                    </div>
                  </Popup>
                </Marker>
                {/* Componente para animar la cámara hacia la ubicación */}
                <MapFlyTo
                  coordinates={[shipData.lat, shipData.lng]}
                  onComplete={() => setIsMapFlying(false)}
                />
              </>
            )}
          </MapContainer>
          {(isLoading || isMapFlying) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando posicion...
              </div>
            </div>
          )}
        </div>
        
        <div className="text-[10px] text-muted-foreground text-center">
          Powered by JsonCargo Mariner Plan
        </div>
      </CardContent>
    </Card>
  )
}

// Componente auxiliar para animar el mapa
function MapFlyTo({ coordinates, onComplete }: { coordinates: [number, number], onComplete: () => void }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    // Anima la cámara suavemente a las coordenadas con un zoom de 8
    map.flyTo(coordinates, 8, { duration: 1.5 })
    map.once('moveend', onComplete)
  }, [coordinates, map, onComplete])
  return null
}