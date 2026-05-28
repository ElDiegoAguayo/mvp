'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'

// Port coordinates dictionary - ALL KEYS IN LOWERCASE
const PORT_DATA: Record<string, { coords: [number, number]; name: string }> = {
  // China
  'puerto de shanghai': { coords: [30.626, 122.063], name: 'Puerto de Shanghai' },
  'puerto de guangzhou': { coords: [22.73, 113.56], name: 'Puerto de Guangzhou' },
  'puerto de shenzhen': { coords: [22.5, 113.883], name: 'Puerto de Shenzhen' },
  'puerto de ningbo-zhoushan': { coords: [29.933, 122.066], name: 'Puerto de Ningbo-Zhoushan' },

  // Estados Unidos
  'puerto de philadelphia': { coords: [39.9, -75.133], name: 'Puerto de Philadelphia' },
  'puerto de los ángeles': { coords: [33.728, -118.262], name: 'Puerto de Los Ángeles' },
  'puerto de long beach': { coords: [33.754, -118.215], name: 'Puerto de Long Beach' },
  'puerto de miami': { coords: [25.776, -80.175], name: 'Puerto de Miami' },
  'puerto de savannah': { coords: [32.126, -81.144], name: 'Puerto de Savannah' },

  // Países Bajos
  'puerto de rotterdam': { coords: [51.949, 4.145], name: 'Puerto de Rotterdam' },

  // España
  'puerto de valencia': { coords: [39.444, -0.316], name: 'Puerto de Valencia' },
  'puerto de barcelona': { coords: [41.346, 2.164], name: 'Puerto de Barcelona' },
  'puerto de algeciras': { coords: [36.141, -5.433], name: 'Puerto de Algeciras' },

  // Japón
  'puerto de tokyo': { coords: [35.617, 139.783], name: 'Puerto de Tokyo' },
  'puerto de yokohama': { coords: [35.433, 139.666], name: 'Puerto de Yokohama' },
  'puerto de kobe': { coords: [34.666, 135.216], name: 'Puerto de Kobe' },

  // Corea del Sur
  'puerto de busan': { coords: [35.1, 129.05], name: 'Puerto de Busan' },
  'puerto de incheon': { coords: [37.45, 126.6], name: 'Puerto de Incheon' },

  // Brasil
  'puerto de santos': { coords: [-23.978, -46.292], name: 'Puerto de Santos' },
  'puerto de paranaguá': { coords: [-25.503, -48.511], name: 'Puerto de Paranaguá' },

  // Colombia
  'puerto de cartagena': { coords: [10.4, -75.533], name: 'Puerto de Cartagena' },
  'puerto de buenaventura': { coords: [3.883, -77.033], name: 'Puerto de Buenaventura' },
}

// Sub-component that handles map animation (Motor de Vuelo)
function MapUpdater({ coordinates }: { coordinates: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    if (coordinates) {
      // Vuela a la nueva coordenada con zoom 12 (ideal para ver ciudades/puertos)
      map.flyTo(coordinates, 12, {
        duration: 1.5,
        easeLinearity: 0.25,
      })
    }
  }, [coordinates, map])

  return null
}

// Custom red icon with glow effect
function createRedIcon() {
  return L.divIcon({
    className: 'custom-map-marker',
    html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 20px rgba(239, 68, 68, 0.9);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  })
}

interface PortMapProps {
  selectedPort: string
}

export default function PortMap({ selectedPort }: PortMapProps) {
  // Normalize port name: lowercase and trim
  const normalizedPort = selectedPort?.toLowerCase().trim()
  const activePort = normalizedPort ? PORT_DATA[normalizedPort] : null
  const coordinates = activePort?.coords || [51.949, 4.145] // Default to Rotterdam
  const portName = activePort?.name || selectedPort || 'Puerto Desconocido'
  const defaultCenter: [number, number] = [20, 0]
  const markerRef = useRef<L.Marker>(null)
  const popupTimerRef = useRef<number | null>(null)

  // Debug: log current port and coordinates
  useEffect(() => {
    console.log('[v0] PortMap - Input Port:', selectedPort)
    console.log('[v0] PortMap - Normalized Port:', normalizedPort)
    console.log('[v0] PortMap - Found in dict:', activePort)
    console.log('[v0] PortMap - Final Coordinates:', coordinates)
  }, [selectedPort, normalizedPort, activePort, coordinates])

  // Open popup when marker is available and coordinates change
  useEffect(() => {
    if (popupTimerRef.current) {
      window.clearTimeout(popupTimerRef.current)
      popupTimerRef.current = null
    }

    if (!markerRef.current || !coordinates) return

    popupTimerRef.current = window.setTimeout(() => {
      const marker = markerRef.current as L.Marker & { _map?: L.Map | null }
      if (!marker || !marker._map) return
      marker.openPopup()
    }, 120)

    return () => {
      if (popupTimerRef.current) {
        window.clearTimeout(popupTimerRef.current)
        popupTimerRef.current = null
      }
    }
  }, [coordinates])

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 h-[350px] shadow-md">
      <MapContainer
        center={defaultCenter}
        zoom={3}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Dynamic map controller (Motor de Vuelo) for fly animation */}
        <MapUpdater coordinates={coordinates} />

        {/* Marker for active port with red indicator and 8km radius area */}
        {coordinates && (
          <>
            <Circle 
              center={coordinates} 
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1.5 }} 
              radius={8000}
            />
            <Marker 
              key={`${coordinates[0]}-${coordinates[1]}`}
              ref={markerRef}
              position={coordinates} 
              icon={createRedIcon()}
            >
              <Popup className="custom-popup">
                <div className="text-sm font-semibold text-slate-900">
                  {portName}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Lat: {coordinates[0].toFixed(3)}°, Lng: {coordinates[1].toFixed(3)}°
                </div>
                <div className="text-xs text-slate-600 mt-2">
                  Área de influencia: 8 km
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  )
}
