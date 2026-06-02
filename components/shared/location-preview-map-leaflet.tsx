'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'

function MapFlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8, easeLinearity: 0.25 })
  }, [center, zoom, map])
  return null
}

function markerIcon() {
  return L.divIcon({
    className: 'location-preview-marker',
    html: '<div style="background:#4063ca;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(64,99,202,.65)"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export function LeafletLocationPreview({
  lat,
  lng,
  radiusMeters,
}: {
  lat: number
  lng: number
  radiusMeters?: number
}) {
  const center: [number, number] = [lat, lng]
  const radius = radiusMeters && radiusMeters > 0 ? radiusMeters : undefined

  return (
    <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} className="z-0">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      <MapFlyTo center={center} zoom={radius ? 14 : 15} />
      <Marker position={center} icon={markerIcon()} />
      {radius ? (
        <Circle
          center={center}
          radius={radius}
          pathOptions={{
            color: '#4063ca',
            fillColor: '#4063ca',
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
      ) : null}
    </MapContainer>
  )
}
