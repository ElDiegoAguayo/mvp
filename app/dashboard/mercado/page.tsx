'use client'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Newspaper,
  Clock,
  Filter,
  Info,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/format-date'
import { DashboardCard } from '@/components/dashboard/dashboard-card'

// Dynamic import for PortMap (ssr: false to avoid hydration issues)
const PortMap = dynamic(() => import('@/components/dashboard/port-map'), {
  ssr: false,
})

// ─────────────────────────────────────────────────────────────────────────────
// Fruit & Variety Catalog (Diccionario de Datos)
// ─────────────────────────────────────────────────────────────────────────────

const FRUIT_VARIETIES: Record<string, string[]> = {
  Cerezas: ['Bing', 'Santina', 'Lapins', 'Regina', 'Sweetheart', 'Kordia'],
  'Uvas de Mesa': ['Red Globe', 'Thompson Seedless', 'Crimson Seedless', 'Autumn Royal', 'Sweet Celebration'],
  Arándanos: ['Duke', 'Legacy', 'Brigitta', 'Emerald', 'Bluecrop'],
  Manzanas: ['Royal Gala', 'Granny Smith', 'Fuji', 'Pink Lady', 'Red Delicious'],
  'Paltas (Aguacates)': ['Hass', 'Edranol', 'Fuerte'],
  Ciruelas: ["D'Agen", 'Angeleno', 'Friar'],
  Kiwis: ['Hayward', 'Jintao (Amarillo)'],
}

const FRUIT_KEYS = Object.keys(FRUIT_VARIETIES)

// ─────────────────────────────────────────────────────────────────────────────
// Country → Port Mapping (Cascading Filters for Agricultural Trade)
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_PORTS: Record<string, string[]> = {
  China: ['Puerto de Shanghai', 'Puerto de Guangzhou', 'Puerto de Shenzhen', 'Puerto de Ningbo-Zhoushan'],
  'Estados Unidos': ['Puerto de Philadelphia', 'Puerto de Los Ángeles', 'Puerto de Long Beach', 'Puerto de Miami', 'Puerto de Savannah'],
  'Países Bajos (Holanda)': ['Puerto de Rotterdam'],
  España: ['Puerto de Valencia', 'Puerto de Barcelona', 'Puerto de Algeciras'],
  Japón: ['Puerto de Tokyo', 'Puerto de Yokohama', 'Puerto de Kobe'],
  'Corea del Sur': ['Puerto de Busan', 'Puerto de Incheon'],
  Brasil: ['Puerto de Santos', 'Puerto de Paranaguá'],
  Colombia: ['Puerto de Cartagena', 'Puerto de Buenaventura'],
}

const COUNTRY_KEYS = Object.keys(COUNTRY_PORTS)

const CURRENCIES: Record<string, { symbol: string; rate: number }> = {
  USD: { symbol: '$', rate: 1 },
  EUR: { symbol: '€', rate: 0.92 },
  UF: { symbol: 'UF ', rate: 0.000027 },
  UTM: { symbol: 'UTM ', rate: 0.000016 },
  CNY: { symbol: '¥', rate: 7.24 },
  JPY: { symbol: '¥', rate: 157.32 },
  BRL: { symbol: 'R$', rate: 5.12 },
  CLP: { symbol: '$', rate: 940 }, // Actualizado a 940
}

const CURRENCY_LABELS: Record<string, string> = {
  USD: 'USD (Dólar)',
  EUR: 'EUR (Euro)',
  UF: 'UF (Unidad de Fomento)',
  UTM: 'UTM',
  CNY: 'CNY (Yuan Chino)',
  JPY: 'JPY (Yen Japonés)',
  BRL: 'BRL (Real Brasileño)',
  CLP: 'CLP (Peso Chileno)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Price Generation (Simulated with no rounding)
// ─────────────────────────────────────────────────────────────────────────────

function generateBasePrice(fruit: string, variety: string): number {
  // Deterministic base price based on fruit + variety hash
  const hash = (fruit + variety).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const base = 2.5 + (hash % 100) / 10 // Range: 2.5 - 12.5 USD
  return base
}

function generateHistoricalPrices(
  fruit: string,
  variety: string,
  country: string,
  port: string,
  days: number = 7
): { date: string; priceRef: number; priceClose: number; variation: number }[] {
  const basePrice = generateBasePrice(fruit, variety)
  // Country-based price multiplier (reflects market demand/logistics)
  const countryMultiplier = 
    country === 'China' ? 1.15 : 
    country === 'Estados Unidos' ? 1.05 : 
    country === 'Países Bajos (Holanda)' ? 1.08 : 
    country === 'España' ? 1.06 :
    country === 'Japón' ? 1.12 :
    country === 'Corea del Sur' ? 1.10 :
    country === 'Brasil' ? 0.95 :
    country === 'Colombia' ? 0.92 : 1.0

  const data: { date: string; priceRef: number; priceClose: number; variation: number }[] = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })

    // Simulate daily fluctuation (no rounding) - include port for variation
    const dayHash = (fruit + variety + country + port + i).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const fluctuation = ((dayHash % 200) - 100) / 1000 // -10% to +10%

    const priceRef = basePrice * countryMultiplier * (1 + fluctuation * 0.5)
    const priceClose = basePrice * countryMultiplier * (1 + fluctuation)
    const variation = ((priceClose - priceRef) / priceRef) * 100

    data.push({ date: dateStr, priceRef, priceClose, variation })
  }

  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(value: number, currency: string): string {
  const { symbol, rate } = CURRENCIES[currency] || CURRENCIES.USD
  const converted = value * rate
  // NO ROUNDING - show all decimals (up to 6 for small units like UF)
  if (currency === 'UF' || currency === 'UTM') {
    return `${symbol}${converted.toFixed(6)}`
  }
  if (currency === 'CLP' || currency === 'JPY') {
    return `${symbol}${converted.toFixed(2)}`
  }
  return `${symbol}${converted.toFixed(2)}`
}

function formatCsvNumber(value: number, currency: string): string {
  const { rate } = CURRENCIES[currency] || CURRENCIES.USD
  const converted = value * rate
  if (currency === 'UF' || currency === 'UTM') {
    return converted.toFixed(6)
  }
  if (currency === 'CLP' || currency === 'JPY') {
    return converted.toFixed(2)
  }
  return converted.toFixed(2)
}

// ──��─────────────────────────────���──────────────────────────���─────────────────
// Chart Data (Daily data for last 360 days ending on current date: May 19, 2026)
// ───────��─────────────────────────────────────────────────────────────────────

function generateChartData(fruit: string, variety: string, country: string, port: string) {
  const base = generateBasePrice(fruit, variety)
  const countryMultiplier = 
    country === 'China' ? 1.15 : 
    country === 'Estados Unidos' ? 1.05 : 
    country === 'Países Bajos (Holanda)' ? 1.08 : 
    country === 'España' ? 1.06 :
    country === 'Japón' ? 1.12 :
    country === 'Corea del Sur' ? 1.10 :
    country === 'Brasil' ? 0.95 :
    country === 'Colombia' ? 0.92 : 1.0

  const data = []
  const endDate = new Date(2026, 4, 19) // May 19, 2026
  
  // Generate 360 days of data backwards from May 19, 2026
  for (let i = 359; i >= 0; i--) {
    const date = new Date(endDate)
    date.setDate(date.getDate() - i)
    
    // Format: DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const dayLabel = `${day}/${month}/${year}`
    
    // Generate price with deterministic variation
    const dayOfYear = Math.floor(i / 1) // Each iteration is one day
    const portHash = (fruit + variety + country + port + i).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const seasonalFactor = 1 + Math.sin((dayOfYear / 360) * Math.PI * 2) * 0.15
    const noise = ((portHash % 200) - 100) / 2000 // Smaller daily noise
    const price = base * countryMultiplier * seasonalFactor * (0.95 + noise)
    
    data.push({
      date: new Date(date),
      dayLabel,
      price: Math.max(0.5, price),
    })
  }
  
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// Market News (Dinámico)
// ─────────────────────────────────────────────────────────────────────────────

function getRelativeTime(minutesAgo: number): string {
  if (minutesAgo < 60) return `Hace ${minutesAgo} min`
  const hoursAgo = Math.floor(minutesAgo / 60)
  if (hoursAgo < 24) return `Hace ${hoursAgo} hora${hoursAgo > 1 ? 's' : ''}`
  const daysAgo = Math.floor(minutesAgo / (60 * 24))
  return `Hace ${daysAgo} día${daysAgo > 1 ? 's' : ''}`
}

const MARKET_NEWS_CONFIG = [
  {
    id: 1,
    title: 'Congestión menor en terminal de contratistas de Philadelphia, reducción de tiempo de espera esperada.',
    minutesAgo: 15,
    urgent: true,
  },
  {
    id: 2,
    title: 'Apertura de ventana comercial prioritaria en Rotterdam para shipments de cereza con descuento logístico.',
    minutesAgo: 120,
    urgent: false,
  },
  {
    id: 3,
    title: 'Alza de demanda en Shanghai por festividades locales, precios de cerezas Bing proyectados al alza.',
    minutesAgo: 240,
    urgent: true,
  },
]

const MARKET_NEWS = MARKET_NEWS_CONFIG.map((news) => ({
  ...news,
  time: getRelativeTime(news.minutesAgo),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Best Port Selection (by current price/profit)
// ─────────────────────────────────────────────────────────────────────────────

function findBestPortByPrice(fruit: string, variety: string, country: string, ports: string[]): string {
  let bestPort = ports[0]
  let bestPrice = 0

  for (const port of ports) {
    const priceData = generateHistoricalPrices(fruit, variety, country, port, 1)
    if (priceData.length > 0) {
      const currentPrice = priceData[0].priceClose
      if (currentPrice > bestPrice) {
        bestPrice = currentPrice
        bestPort = port
      }
    }
  }

  return bestPort
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Tooltip
// ───────────────────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  currency = 'USD',
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  currency?: string
}) {
  if (!active || !payload) return null
  const { symbol, rate } = CURRENCIES[currency] || CURRENCIES.USD
  return (
    <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg p-3 shadow-xl">
      <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">{label}</p>
      {payload.map((entry, idx) => {
        const converted = entry.value * rate
        return (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600 dark:text-gray-300 capitalize">{entry.name}:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{symbol}{converted.toFixed(2)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MercadoPage() {
  // Filter state
  const [selectedFruit, setSelectedFruit] = useState<string>(FRUIT_KEYS[0])
  const [selectedVariety, setSelectedVariety] = useState<string>(FRUIT_VARIETIES[FRUIT_KEYS[0]][0])
  const [selectedCountry, setSelectedCountry] = useState<string>(COUNTRY_KEYS[0])
  const [selectedPort, setSelectedPort] = useState<string>(COUNTRY_PORTS[COUNTRY_KEYS[0]][0])
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')
  const [autoSelectedPort, setAutoSelectedPort] = useState<boolean>(false)
  
  // Advanced time filters
  const [selectedYear, setSelectedYear] = useState<string>('2026')
  const [selectedMonth, setSelectedMonth] = useState<string>('5') // May
  const [customDateFrom, setCustomDateFrom] = useState<string>('2025-05-19')
  const [customDateTo, setCustomDateTo] = useState<string>('2026-05-19')
  const [useCustomRange, setUseCustomRange] = useState<boolean>(false)

  // Market news state
  const [marketNews, setMarketNews] = useState<Array<{ title: string; link: string; pubDate: string }>>([])
  const [newsLoading, setNewsLoading] = useState<boolean>(true)
  const [newsError, setNewsError] = useState<boolean>(false)

  // Fetch market news from real API
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true)
        setNewsError(false)
        const response = await fetch(
          'https://api.rss2json.com/v1/api.json?rss_url=https://www.portalfruticola.com/feed/'
        )
        const data = await response.json()
        
        if (data.items && Array.isArray(data.items)) {
          // Extract first 4 items
          const items = data.items.slice(0, 4).map((item: any) => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
          }))
          setMarketNews(items)
        } else {
          setNewsError(true)
        }
      } catch (err) {
        console.error('[v0] Market news fetch error:', err)
        setNewsError(true)
      } finally {
        setNewsLoading(false)
      }
    }

    fetchNews()
  }, [])

  // Handle fruit change and reset variety accordingly
  const handleFruitChange = (fruit: string) => {
    setSelectedFruit(fruit)
    const varieties = FRUIT_VARIETIES[fruit] || []
    setSelectedVariety(varieties[0] || '')
  }

  // Auto-select best port when country changes
  const handleCountryChange = (country: string) => {
    setSelectedCountry(country)
    const ports = COUNTRY_PORTS[country]
    const bestPort = findBestPortByPrice(selectedFruit, selectedVariety, country, ports)
    setSelectedPort(bestPort)
    setAutoSelectedPort(true)
  }

  // Available varieties based on selected fruit
  const availableVarieties = FRUIT_VARIETIES[selectedFruit] || []

  // Available ports based on selected country
  const availablePorts = COUNTRY_PORTS[selectedCountry] || []

  // Historical data for table
  const historicalData = useMemo(
    () => generateHistoricalPrices(selectedFruit, selectedVariety, selectedCountry, selectedPort, 7),
    [selectedFruit, selectedVariety, selectedCountry, selectedPort]
  )

  // Chart data (12 months)
  const fullChartData = useMemo(
    () => generateChartData(selectedFruit, selectedVariety, selectedCountry, selectedPort),
    [selectedFruit, selectedVariety, selectedCountry, selectedPort]
  )

  // Filter chart data by year/month and custom range
  const chartData = useMemo(() => {
    let filtered = fullChartData
    
    if (useCustomRange) {
      // Parse custom date range
      const fromParts = customDateFrom.split('-')
      const toParts = customDateTo.split('-')
      const fromDate = new Date(parseInt(fromParts[0]), parseInt(fromParts[1]) - 1, parseInt(fromParts[2]))
      const toDate = new Date(parseInt(toParts[0]), parseInt(toParts[1]) - 1, parseInt(toParts[2]))
      
      filtered = fullChartData.filter(item => item.date >= fromDate && item.date <= toDate)
    } else {
      // Filter by selected year and month only
      const year = parseInt(selectedYear)
      const month = parseInt(selectedMonth)
      filtered = fullChartData.filter(item => {
        return item.date.getFullYear() === year && item.date.getMonth() === month - 1
      })
    }
    
    // Convert prices based on selected currency
    const { rate } = CURRENCIES[selectedCurrency] || CURRENCIES.USD
    return filtered.map(item => ({
      ...item,
      month: item.dayLabel,
      price: item.price * rate
    }))
  }, [fullChartData, selectedYear, selectedMonth, useCustomRange, customDateFrom, customDateTo, selectedCurrency])

  // Current price summary
  const latestData = historicalData[historicalData.length - 1]
  const previousData = historicalData[historicalData.length - 2]
  const weeklyChange = previousData
    ? ((latestData.priceClose - previousData.priceClose) / previousData.priceClose) * 100
    : 0

  const handleExportCsv = () => {
    const headers = [
      'Fecha',
      'Fruta',
      'Variedad',
      'Destino',
      'Puerto',
      'Precio Ref. Anterior',
      'Precio Cierre Hoy',
      'Variacion (%)',
      'Moneda',
    ]

    const rows = historicalData.map((row) => [
      row.date,
      selectedFruit,
      selectedVariety,
      selectedCountry,
      selectedPort,
      formatCsvNumber(row.priceRef, selectedCurrency),
      formatCsvNumber(row.priceClose, selectedCurrency),
      row.variation.toFixed(2),
      selectedCurrency,
    ])

    const escapeCsv = (value: string | number) => {
      const stringValue = String(value)
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mercado-precios-fob-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Inteligencia de Mercado (Exportación)
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Fuentes y metodología de datos"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors w-6 h-6"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  <div className="space-y-2">
                    <p className="font-semibold">Fuentes de Datos</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Mercado Nacional y FOB: ODEPA (Oficina de Estudios y Políticas Agrarias).</li>
                      <li>Mercado Norteamericano: USDA AMS (Agricultural Marketing Service).</li>
                      <li>Divisas: Indicadores diarios del Banco Central de Chile.</li>
                    </ul>
                    <p className="opacity-80">
                      Nota: El sistema consolida estas fuentes públicas para entregar una tendencia de mercado.
                      Los precios finales de liquidación dependen de las condiciones específicas de cada recibidor.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Precios de referencia FOB en principales mercados de destino
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-slate-50 dark:bg-[#0B0F19] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtros Avanzados</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Filter 1: Fruit */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Fruta
            </label>
            <select
              value={selectedFruit}
              onChange={(e) => handleFruitChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {FRUIT_KEYS.map((fruit) => (
                <option key={fruit} value={fruit}>
                  {fruit}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Variety (dependent on Fruit) */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Variedad
            </label>
            <select
              value={selectedVariety}
              onChange={(e) => setSelectedVariety(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {availableVarieties.map((variety) => (
                <option key={variety} value={variety}>
                  {variety}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Destination Country */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              País de Destino
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {COUNTRY_KEYS.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: Destination Port (dependent on Country) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Puerto de Destino
              </label>
              {autoSelectedPort && (
                <span className="text-[10px] font-semibold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Auto
                </span>
              )}
            </div>
            <select
              value={selectedPort}
              onChange={(e) => {
                setSelectedPort(e.target.value)
                setAutoSelectedPort(false)
              }}
              disabled={!selectedCountry}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!selectedCountry && <option>Selecciona país primero</option>}
              {availablePorts.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 5: Currency */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Moneda
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.keys(CURRENCIES).map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_LABELS[code]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <DashboardCard
        contentClassName="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedFruit} - {selectedVariety}
              </p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {formatPrice(latestData.priceClose, selectedCurrency)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Precio FOB por kg · {selectedCountry} - {selectedPort}
              </p>
            </div>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                weeklyChange > 0
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                  : weeklyChange < 0
                    ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {weeklyChange > 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : weeklyChange < 0 ? (
                <TrendingDown className="w-5 h-5" />
              ) : (
                <Minus className="w-5 h-5" />
              )}
              <span className="font-semibold">
                {weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)}%
              </span>
              <span className="text-xs opacity-75">vs. ayer</span>
            </div>
          </div>
      </DashboardCard>

      {/* Port Map Section */}
      <DashboardCard
        header={
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Mapa de Puertos de Destino</h3>
          </div>
        }
      >
          <PortMap key={selectedPort} selectedPort={selectedPort} />
      </DashboardCard>

      {/* Main Content: Table + Chart + News */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historical Data Table */}
        <DashboardCard
          className="lg:col-span-2"
          header={
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Histórico de Precios (Últimos 7 días)</h3>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Exportar CSV
              </button>
            </div>
          }
        >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">Fecha</th>
                    <th className="text-left py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">Variedad</th>
                    <th className="text-left py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">Destino</th>
                    <th className="text-right py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">Precio Ref. Anterior</th>
                    <th className="text-right py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">Precio Cierre Hoy</th>
                    <th className="text-right py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">Variación (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-2 text-slate-700 dark:text-slate-300">{row.date}</td>
                      <td className="py-3 px-2 text-slate-700 dark:text-slate-300">{selectedVariety}</td>
                      <td className="py-3 px-2 text-slate-500 dark:text-slate-400 text-xs">{selectedCountry}</td>
                      <td className="py-3 px-2 text-right text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {formatPrice(row.priceRef, selectedCurrency)}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-900 dark:text-white font-semibold font-mono">
                        {formatPrice(row.priceClose, selectedCurrency)}
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-medium ${
                          row.variation > 0
                            ? 'text-green-600 dark:text-green-400'
                            : row.variation < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {row.variation > 0 ? '+' : ''}{row.variation.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
              Los valores presentados son referenciales y se actualizan en base a los reportes de precios FOB de ODEPA
              (Ministerio de Agricultura de Chile), USDA Market News (EE.UU.) y boletines de terminales mayoristas
              internacionales. El tipo de cambio utiliza el valor del Dólar Observado del Banco Central.
            </p>
        </DashboardCard>

        {/* News Panel */}
        <DashboardCard
          header={
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Alertas de Mercado</h3>
            </div>
          }
          contentClassName="space-y-4"
        >
            {newsLoading ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 dark:text-slate-400">Actualizando inteligencia de mercado...</p>
              </div>
            ) : newsError ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-600 dark:text-red-400">No se pudieron cargar las alertas en este momento.</p>
              </div>
            ) : marketNews.length > 0 ? (
              marketNews.map((news, idx) => {
                const timeStr = formatDate(news.pubDate)
                
                return (
                  <a
                    key={idx}
                    href={news.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-[#334155] hover:border-primary dark:hover:border-primary/50 transition-colors"
                  >
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-gray-300 line-clamp-3">
                      {news.title}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-500 dark:text-gray-500">
                      <Clock className="w-3 h-3" />
                      {timeStr}
                    </div>
                  </a>
                )
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 dark:text-slate-400">No hay alertas disponibles.</p>
              </div>
            )}
        </DashboardCard>
      </div>

      {/* Chart Section */}
      <DashboardCard
        header={
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tendencia Histórica de Precios - {selectedFruit} {selectedVariety}</h3>
          </div>
        }
        contentClassName="space-y-4"
      >
          {/* Advanced Time Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <input
                  type="radio"
                  name="timeMode"
                  checked={!useCustomRange}
                  onChange={() => setUseCustomRange(false)}
                  className="mr-1"
                />
                Por Mes
              </label>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <input
                  type="radio"
                  name="timeMode"
                  checked={useCustomRange}
                  onChange={() => setUseCustomRange(true)}
                  className="mr-1"
                />
                Rango Personalizado
              </label>
            </div>

            {!useCustomRange ? (
              <div className="grid grid-cols-2 gap-3">
                {/* Year Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Año
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>

                {/* Month Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Mes
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Date From */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    max="2026-05-19"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    max="2026-05-19"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-[#334155]" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#64748B"
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  className="dark:stroke-[#334155]"
                />
                <YAxis
                  stroke="#64748B"
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(v) => `${CURRENCIES[selectedCurrency].symbol}${v.toFixed(0)}`}
                  className="dark:stroke-[#334155]"
                />
                <RechartsTooltip content={<CustomTooltip currency={selectedCurrency} />} />
                <Legend
                  wrapperStyle={{ paddingTop: 16 }}
                  formatter={(value) => <span className="text-slate-600 dark:text-gray-300 capitalize">{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  name={`${selectedFruit} ${selectedVariety}`}
                  stroke="#4063ca"
                  strokeWidth={3}
                  dot={{ fill: '#4063ca', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
    </div>
  )
}
