'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { cn } from '@/lib/utils'
import {
  distanceMeters,
  isWithinGeofence,
  type GeofenceLocation,
} from '@/lib/tech-assistance/geofence'

function MapFlyTo({
  center,
  zoom,
}: {
  center: [number, number]
  zoom: number
}) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 })
  }, [center, zoom, map])
  return null
}

function MapFitBounds({ locations }: { locations: GeofenceLocation[] }) {
  const map = useMap()
  useEffect(() => {
    if (locations.length === 0) return
    if (locations.length === 1) {
      map.flyTo([locations[0].lat, locations[0].lng], 15, { duration: 1.2 })
      return
    }
    const bounds = L.latLngBounds(
      locations.map(loc => [loc.lat, loc.lng] as [number, number]),
    )
    map.flyToBounds(bounds.pad(0.25), { duration: 1.2, maxZoom: 14 })
  }, [locations, map])
  return null
}

function siteIcon() {
  return L.divIcon({
    className: 'tech-geofence-site-marker',
    html: '<div style="background:#4063ca;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(64,99,202,.7)"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function userIcon(inRange: boolean) {
  const color = inRange ? '#10b981' : '#f59e0b'
  return L.divIcon({
    className: 'tech-geofence-user-marker',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px ${color}99"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

export interface TechAssistanceGeofenceMapProps {
  activeLocation: GeofenceLocation | null
  clientLocations?: GeofenceLocation[]
  userPosition: { lat: number; lng: number } | null
  statusLabel?: string
  statusTone?: 'neutral' | 'ok' | 'warn'
  className?: string
}

export default function TechAssistanceGeofenceMap({
  activeLocation,
  clientLocations = [],
  userPosition,
  statusLabel,
  statusTone = 'neutral',
  className,
}: TechAssistanceGeofenceMapProps) {
  const locationsToShow = useMemo(() => {
    if (activeLocation) return [activeLocation]
    return clientLocations
  }, [activeLocation, clientLocations])

  const defaultCenter = useMemo((): [number, number] => {
    if (activeLocation) return [activeLocation.lat, activeLocation.lng]
    if (clientLocations[0]) return [clientLocations[0].lat, clientLocations[0].lng]
    return [-36.8269, -73.0498]
  }, [activeLocation, clientLocations])

  const userInRange = useMemo(() => {
    if (!userPosition || !activeLocation) return null
    return isWithinGeofence(
      userPosition.lat,
      userPosition.lng,
      activeLocation.lat,
      activeLocation.lng,
      activeLocation.radius_meters,
    )
  }, [userPosition, activeLocation])

  const hasMapData = locationsToShow.length > 0

  return (
    <div className={cn('space-y-2', className)}>
      {statusLabel && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            statusTone === 'ok' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
            statusTone === 'warn' && 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
            statusTone === 'neutral' && 'border-border bg-secondary/40 text-muted-foreground',
          )}
        >
          {statusLabel}
        </div>
      )}

      <div className="h-[280px] overflow-hidden rounded-xl border border-border bg-slate-900 shadow-sm">
        {hasMapData ? (
          <MapContainer
            center={defaultCenter}
            zoom={activeLocation ? 15 : 12}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {activeLocation ? (
              <MapFlyTo center={[activeLocation.lat, activeLocation.lng]} zoom={15} />
            ) : (
              <MapFitBounds locations={clientLocations} />
            )}

            {locationsToShow.map(loc => (
              <Circle
                key={loc.id}
                center={[loc.lat, loc.lng]}
                radius={loc.radius_meters}
                pathOptions={{
                  color: activeLocation?.id === loc.id ? '#4063ca' : '#64748b',
                  fillColor: activeLocation?.id === loc.id ? '#4063ca' : '#64748b',
                  fillOpacity: 0.12,
                  weight: 2,
                }}
              />
            ))}

            {locationsToShow.map(loc => (
              <Marker
                key={`m-${loc.id}`}
                position={[loc.lat, loc.lng]}
                icon={siteIcon()}
              />
            ))}

            {userPosition && (
              <Marker
                position={[userPosition.lat, userPosition.lng]}
                icon={userIcon(userInRange === true)}
              />
            )}
          </MapContainer>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            —
          </div>
        )}
      </div>

      {activeLocation && userPosition && userInRange === false && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {Math.round(
            distanceMeters(
              userPosition.lat,
              userPosition.lng,
              activeLocation.lat,
              activeLocation.lng,
            ),
          )}{' '}
          m del punto · máx. {activeLocation.radius_meters} m
        </p>
      )}
    </div>
  )
}
