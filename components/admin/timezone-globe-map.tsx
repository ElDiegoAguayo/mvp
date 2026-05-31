'use client'

import { memo, useCallback, useId, useRef } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Sphere,
  Graticule,
  Marker,
} from 'react-simple-maps'
import { geoCentroid, geoContains, geoOrthographic } from 'd3-geo'
import type { GeoPermissibleObjects } from 'd3-geo'

const MAP_SIZE = 400
const CENTER = MAP_SIZE / 2
const SCALE = 195
const DRAG_THRESHOLD = 6

interface TimezoneGlobeMapProps {
  geoUrl: string
  rotation: [number, number, number]
  onRotationChange: (rotation: [number, number, number]) => void
  selectedCountryKey: string | null | undefined
  selectedFlagUrl: string | null | undefined
  onCountryClick: (countryName: string) => void
  onOceanClick: (latitude: number, longitude: number) => void
}

type GlobeGeography = GeoPermissibleObjects & {
  properties?: { name?: string }
  rsmKey: string
}

function isPointVisibleOnGlobe(
  longitude: number,
  latitude: number,
  rotation: [number, number, number],
): boolean {
  const centerLng = -rotation[0]
  const centerLat = -rotation[1]
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLng = toRad(longitude - centerLng)
  const lat1 = toRad(latitude)
  const lat2 = toRad(centerLat)
  const cosAngle = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return cosAngle > 0.08
}

function resolveMarkerCoordinates(
  geographies: GlobeGeography[],
  selectedCountryKey: string | null | undefined,
  rotation: [number, number, number],
): [number, number] | null {
  if (!selectedCountryKey || selectedCountryKey.startsWith('coord:')) return null
  const geo = geographies.find(g => g.properties?.name === selectedCountryKey)
  if (!geo) return null
  try {
    const [lng, lat] = geoCentroid(geo)
    if (!isPointVisibleOnGlobe(lng, lat, rotation)) return null
    return [lng, lat]
  } catch {
    return null
  }
}

export const TimezoneGlobeMap = memo(function TimezoneGlobeMap({
  geoUrl,
  rotation,
  onRotationChange,
  selectedCountryKey,
  selectedFlagUrl,
  onCountryClick,
  onOceanClick,
}: TimezoneGlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const flagClipId = useId().replace(/:/g, '')
  const geographiesRef = useRef<GlobeGeography[]>([])
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  })

  const projectPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = containerRef.current?.querySelector('svg.rsm-svg')
      if (!svg) return null

      const rect = svg.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * MAP_SIZE
      const y = ((clientY - rect.top) / rect.height) * MAP_SIZE

      const projection = geoOrthographic()
        .rotate(rotation)
        .translate([CENTER, CENTER])
        .scale(SCALE)

      const coords = projection.invert?.([x, y])
      if (!coords) return null
      const [longitude, latitude] = coords
      const dist = Math.hypot(x - CENTER, y - CENTER)
      if (dist > SCALE) return null
      return { latitude, longitude }
    },
    [rotation],
  )

  const findCountryAtCoordinates = useCallback((longitude: number, latitude: number): string | null => {
    const point: [number, number] = [longitude, latitude]
    for (const geo of geographiesRef.current) {
      try {
        if (geoContains(geo, point)) {
          const name = String(geo.properties?.name ?? '').trim()
          if (name) return name
        }
      } catch {
        /* skip malformed geometries */
      }
    }
    return null
  }, [])

  const handleSelectionAt = useCallback(
    (clientX: number, clientY: number) => {
      const projected = projectPoint(clientX, clientY)
      if (!projected) return

      const countryName = findCountryAtCoordinates(projected.longitude, projected.latitude)
      if (countryName) {
        onCountryClick(countryName)
        return
      }

      onOceanClick(projected.latitude, projected.longitude)
    },
    [findCountryAtCoordinates, onCountryClick, onOceanClick, projectPoint],
  )

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    }
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!dragRef.current.active) return
    const dx = event.clientX - dragRef.current.lastX
    const dy = event.clientY - dragRef.current.lastY
    const totalDx = event.clientX - dragRef.current.startX
    const totalDy = event.clientY - dragRef.current.startY
    if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true
    }
    dragRef.current.lastX = event.clientX
    dragRef.current.lastY = event.clientY
    onRotationChange([
      rotation[0] + dx * 0.35,
      Math.max(-60, Math.min(60, rotation[1] - dy * 0.35)),
      rotation[2],
    ])
  }

  const handleMouseUp = (event: React.MouseEvent) => {
    if (!dragRef.current.active) return
    const wasDrag = dragRef.current.moved
    dragRef.current.active = false
    dragRef.current.moved = false

    if (wasDrag) return
    handleSelectionAt(event.clientX, event.clientY)
  }

  const handleMouseLeave = () => {
    dragRef.current.active = false
    dragRef.current.moved = false
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return
    dragRef.current = {
      active: true,
      moved: false,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
    }
  }

  const handleTouchMove = (event: React.TouchEvent) => {
    const touch = event.touches[0]
    if (!touch || !dragRef.current.active) return
    const dx = touch.clientX - dragRef.current.lastX
    const dy = touch.clientY - dragRef.current.lastY
    const totalDx = touch.clientX - dragRef.current.startX
    const totalDy = touch.clientY - dragRef.current.startY
    if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true
    }
    dragRef.current.lastX = touch.clientX
    dragRef.current.lastY = touch.clientY
    onRotationChange([
      rotation[0] + dx * 0.35,
      Math.max(-60, Math.min(60, rotation[1] - dy * 0.35)),
      rotation[2],
    ])
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!dragRef.current.active) return
    const wasDrag = dragRef.current.moved
    dragRef.current.active = false
    dragRef.current.moved = false

    const touch = event.changedTouches[0]
    if (!touch || wasDrag) return
    handleSelectionAt(touch.clientX, touch.clientY)
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-[420px] cursor-grab select-none active:cursor-grabbing"
      style={{ touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <ComposableMap
        width={MAP_SIZE}
        height={MAP_SIZE}
        projection="geoOrthographic"
        projectionConfig={{
          rotate: rotation,
          scale: SCALE,
        }}
        className="mx-auto h-auto w-full pointer-events-none"
      >
        <Sphere id="tz-sphere" fill="#0c1424" stroke="#475569" strokeWidth={0.5} />
        <Graticule stroke="#1e293b" strokeWidth={0.35} />
        <Geographies geography={geoUrl}>
          {({ geographies }) => {
            geographiesRef.current = geographies as GlobeGeography[]
            const markerCoordinates = resolveMarkerCoordinates(
              geographies as GlobeGeography[],
              selectedCountryKey,
              rotation,
            )

            return (
              <>
                {geographies.map(geo => {
                  const name = String(geo.properties?.name ?? '')
                  const isSelected = selectedCountryKey === name

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: isSelected ? '#4063ca' : '#1e3a5f',
                          stroke: isSelected ? '#93c5fd' : '#334155',
                          strokeWidth: isSelected ? 0.9 : 0.4,
                          outline: 'none',
                        },
                        hover: {
                          fill: isSelected ? '#5278e8' : '#2563eb',
                          stroke: '#93c5fd',
                          strokeWidth: 0.7,
                          outline: 'none',
                        },
                        pressed: {
                          fill: '#4063ca',
                          outline: 'none',
                        },
                      }}
                    />
                  )
                })}

                {markerCoordinates && selectedFlagUrl && (
                  <Marker coordinates={markerCoordinates}>
                    <g pointerEvents="none">
                      <circle r={22} fill="#4063ca" stroke="#ffffff" strokeWidth={2} opacity={0.95} />
                      <circle r={19} fill="#ffffff" opacity={1} />
                      <clipPath id={flagClipId}>
                        <rect x={-16} y={-11} width={32} height={22} rx={2} />
                      </clipPath>
                      <image
                        href={selectedFlagUrl}
                        x={-16}
                        y={-11}
                        width={32}
                        height={22}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#${flagClipId})`}
                      />
                    </g>
                  </Marker>
                )}
              </>
            )
          }}
        </Geographies>
      </ComposableMap>
    </div>
  )
})
