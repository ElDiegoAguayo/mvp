'use client'

import { useState, useEffect } from 'react'
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Eye,
  Gauge,
  Calendar,
  ChevronDown,
} from 'lucide-react'
import { DashboardCard } from '@/components/dashboard/dashboard-card'

// Regiones de Chile con coordenadas
const REGIONES_CHILE: Record<string, { lat: number; lon: number; name: string }> = {
  coquimbo: { lat: -29.902, lon: -71.251, name: 'Coquimbo (La Serena)' },
  valparaiso: { lat: -33.045, lon: -71.62, name: 'Valparaíso' },
  metropolitana: { lat: -33.448, lon: -70.669, name: 'Región Metropolitana' },
  ohiggins: { lat: -34.17, lon: -70.74, name: "O'Higgins (Rancagua)" },
  maule: { lat: -35.426, lon: -71.655, name: 'Maule (Talca)' },
  nuble: { lat: -36.606, lon: -72.103, name: 'Ñuble (Chillán)' },
  biobio: { lat: -36.82, lon: -73.044, name: 'Biobío (Concepción)' },
  araucania: { lat: -38.735, lon: -72.59, name: 'Araucanía (Temuco)' },
  los_rios: { lat: -39.814, lon: -73.245, name: 'Los Ríos (Valdivia)' },
  los_lagos: { lat: -41.469, lon: -72.942, name: 'Los Lagos (Puerto Montt)' },
}

interface WeatherData {
  current: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    precipitation: number
    weather_code: number
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weather_code: number[]
  }
}

// Mapeo de códigos WMO a íconos
function getWeatherIcon(code: number, size = 24) {
  if (code === 0) {
    return <Sun className={`w-${size} h-${size} text-yellow-400`} />
  } else if (code <= 3) {
    return <Cloud className={`w-${size} h-${size} text-gray-400`} />
  } else if (code === 45 || code === 48) {
    return <Wind className={`w-${size} h-${size} text-gray-300`} />
  } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return <CloudRain className={`w-${size} h-${size} text-blue-400`} />
  } else if ([71, 73, 75, 85, 86].includes(code)) {
    return <CloudSnow className={`w-${size} h-${size} text-white`} />
  } else if ([95, 96, 99].includes(code)) {
    return <CloudLightning className={`w-${size} h-${size} text-purple-400`} />
  }
  
  return <Cloud className={`w-${size} h-${size} text-gray-400`} />
}

export function WeatherWidget() {
  const [selectedRegion, setSelectedRegion] = useState<string>('metropolitana')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const region = REGIONES_CHILE[selectedRegion]

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=America%2FSantiago&models=best_match`
        
        const response = await fetch(url)
        const data = await response.json()
        
        setWeather(data as WeatherData)
      } catch (err) {
        console.error('[v0] Weather fetch error:', err)
        setError('No se pudo cargar el clima')
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
  }, [region])

  if (loading) {
    return (
      <DashboardCard
        header={<h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pronóstico Meteorológico</h3>}
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando datos climáticos...</p>
      </DashboardCard>
    )
  }

  if (error || !weather) {
    return (
      <DashboardCard
        header={<h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pronóstico Meteorológico</h3>}
      >
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </DashboardCard>
    )
  }

  const current = weather.current
  const daily = weather.daily

  return (
    <DashboardCard
      header={
        <div className="flex items-center justify-between w-full">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pronóstico Meteorológico</h3>
          <div className="relative">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="appearance-none px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary pr-8"
            >
              {Object.entries(REGIONES_CHILE).map(([key, data]) => (
                <option key={key} value={key}>
                  {data.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>
      }
      contentClassName="space-y-6"
    >
        {/* Temperatura Actual Grande */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-5xl font-bold text-slate-900 dark:text-white">
              {Math.round(current.temperature_2m)}°
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Temperatura Actual</p>
          </div>
          <div className="text-6xl">
            {getWeatherIcon(current.weather_code, 64)}
          </div>
        </div>

        {/* Cuadrícula 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 dark:bg-[#0B0F19] p-3 rounded-lg border border-slate-200 dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Sensación</span>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {Math.round(current.apparent_temperature)}°C
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#0B0F19] p-3 rounded-lg border border-slate-200 dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Humedad</span>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {current.relative_humidity_2m}%
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#0B0F19] p-3 rounded-lg border border-slate-200 dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-1">
              <Wind className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Viento</span>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {Math.round(current.wind_speed_10m)} km/h
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#0B0F19] p-3 rounded-lg border border-slate-200 dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Precipitación</span>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {current.precipitation} mm
            </p>
          </div>
        </div>

        {/* Pronóstico Semanal */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Próximos 7 días</h3>
          </div>
          <div className="space-y-2">
            {daily.time.slice(0, 7).map((date, idx) => {
              const maxTemp = daily.temperature_2m_max[idx]
              const minTemp = daily.temperature_2m_min[idx]
              const code = daily.weather_code[idx]
              const dayName = new Date(date).toLocaleDateString('es-CL', { weekday: 'short' })

              return (
                <div
                  key={date}
                  className="flex items-center justify-between p-2 bg-slate-50 dark:bg-[#0B0F19] rounded border border-slate-200 dark:border-[#334155]"
                >
                  <div className="flex items-center gap-2 flex-1">
                    {getWeatherIcon(code, 16)}
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-12">
                      {dayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      {Math.round(minTemp)}°
                    </span>
                    <div className="w-12 bg-gradient-to-r from-blue-400 to-orange-400 h-1 rounded"></div>
                    <span className="text-slate-900 dark:text-white font-semibold w-6 text-right">
                      {Math.round(maxTemp)}°
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </DashboardCard>
    )
}

