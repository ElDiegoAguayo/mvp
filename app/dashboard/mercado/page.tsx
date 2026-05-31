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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLocale } from '@/components/i18n/locale-provider'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { exportStyledReportExcel } from '@/lib/excel/upcrop-excel-theme'
import {
  COUNTRY_KEYS,
  COUNTRY_MULTIPLIERS,
  COUNTRY_PORTS,
  CURRENCY_CODES,
  FRUIT_KEYS,
  FRUIT_VARIETIES,
  formatMercadoDate,
  formatMercadoNewsDate,
  getCountryLabel,
  getCurrencyLabel,
  getFruitLabel,
  getPortLabel,
  getPortMapLookupLabel,
  getVarietyLabel,
  type CountryKey,
  type CurrencyCode,
  type FruitKey,
  type PortKey,
} from '@/lib/mercado/catalog'

// Dynamic import for PortMap (ssr: false to avoid hydration issues)
const PortMap = dynamic(() => import('@/components/dashboard/port-map'), {
  ssr: false,
})

const CURRENCIES: Record<CurrencyCode, { symbol: string; rate: number }> = {
  USD: { symbol: '$', rate: 1 },
  EUR: { symbol: '€', rate: 0.92 },
  UF: { symbol: 'UF ', rate: 0.000027 },
  UTM: { symbol: 'UTM ', rate: 0.000016 },
  CNY: { symbol: '¥', rate: 7.24 },
  JPY: { symbol: '¥', rate: 157.32 },
  BRL: { symbol: 'R$', rate: 5.12 },
  CLP: { symbol: '$', rate: 940 }, // Actualizado a 940
}

// ─────────────────────────────────────────────────────────────────────────────
// Price Generation (Simulated with no rounding)
// ─────────────────────────────────────────────────────────────────────────────

function generateBasePrice(fruit: FruitKey, variety: string): number {
  // Deterministic base price based on fruit + variety hash
  const hash = (fruit + variety).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const base = 2.5 + (hash % 100) / 10 // Range: 2.5 - 12.5 USD
  return base
}

function generateHistoricalPrices(
  fruit: FruitKey,
  variety: string,
  country: CountryKey,
  port: PortKey,
  locale: 'es' | 'en',
  days: number = 7,
): { date: string; priceRef: number; priceClose: number; variation: number }[] {
  const basePrice = generateBasePrice(fruit, variety)
  const countryMultiplier = COUNTRY_MULTIPLIERS[country] ?? 1.0

  const data: { date: string; priceRef: number; priceClose: number; variation: number }[] = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = formatMercadoDate(date, locale)

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

function formatPrice(value: number, currency: CurrencyCode): string {
  const { symbol, rate } = CURRENCIES[currency]
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

// ─────────────────────────────────────────────────────────────────────────────
// Chart Data (Daily data for last 360 days ending on current date: May 19, 2026)
// ───────��─────────────────────────────────────────────────────────────────────

function generateChartData(
  fruit: FruitKey,
  variety: string,
  country: CountryKey,
  port: PortKey,
  locale: 'es' | 'en',
) {
  const base = generateBasePrice(fruit, variety)
  const countryMultiplier = COUNTRY_MULTIPLIERS[country] ?? 1.0

  const data = []
  const endDate = new Date(2026, 4, 19) // May 19, 2026
  
  // Generate 360 days of data backwards from May 19, 2026
  for (let i = 359; i >= 0; i--) {
    const date = new Date(endDate)
    date.setDate(date.getDate() - i)
    const dayLabel = formatMercadoDate(date, locale)
    
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
// Best Port Selection (by current price/profit)
// ─────────────────────────────────────────────────────────────────────────────

function findBestPortByPrice(
  fruit: FruitKey,
  variety: string,
  country: CountryKey,
  ports: readonly PortKey[],
  locale: 'es' | 'en',
): PortKey {
  let bestPort = ports[0]
  let bestPrice = 0

  for (const port of ports) {
    const priceData = generateHistoricalPrices(fruit, variety, country, port, locale, 1)
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
  currency?: CurrencyCode
}) {
  if (!active || !payload) return null
  const { symbol, rate } = CURRENCIES[currency]
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
  const { t, locale } = useLocale()

  // Filter state
  const [selectedFruit, setSelectedFruit] = useState<FruitKey>(FRUIT_KEYS[0])
  const [selectedVariety, setSelectedVariety] = useState<string>(FRUIT_VARIETIES[FRUIT_KEYS[0]][0])
  const [selectedCountry, setSelectedCountry] = useState<CountryKey>(COUNTRY_KEYS[0])
  const [selectedPort, setSelectedPort] = useState<PortKey>(COUNTRY_PORTS[COUNTRY_KEYS[0]][0])
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('USD')
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
  const [exporting, setExporting] = useState(false)

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
  const handleFruitChange = (fruit: FruitKey) => {
    setSelectedFruit(fruit)
    const varieties = FRUIT_VARIETIES[fruit] || []
    setSelectedVariety(varieties[0] || '')
  }

  // Auto-select best port when country changes
  const handleCountryChange = (country: CountryKey) => {
    setSelectedCountry(country)
    const ports = COUNTRY_PORTS[country]
    const bestPort = findBestPortByPrice(selectedFruit, selectedVariety, country, ports, locale)
    setSelectedPort(bestPort)
    setAutoSelectedPort(true)
  }

  // Available varieties based on selected fruit
  const availableVarieties = FRUIT_VARIETIES[selectedFruit] || []

  // Available ports based on selected country
  const availablePorts = COUNTRY_PORTS[selectedCountry] || []

  // Historical data for table
  const historicalData = useMemo(
    () => generateHistoricalPrices(selectedFruit, selectedVariety, selectedCountry, selectedPort, locale, 7),
    [selectedFruit, selectedVariety, selectedCountry, selectedPort, locale],
  )

  // Chart data (12 months)
  const fullChartData = useMemo(
    () => generateChartData(selectedFruit, selectedVariety, selectedCountry, selectedPort, locale),
    [selectedFruit, selectedVariety, selectedCountry, selectedPort, locale],
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

  const handleExportExcel = async () => {
    if (historicalData.length === 0) return

    setExporting(true)
    try {
      const { rate } = CURRENCIES[selectedCurrency] || CURRENCIES.USD
      const headers = [
        t('mercado.export.headers.date'),
        t('mercado.export.headers.fruit'),
        t('mercado.export.headers.variety'),
        t('mercado.export.headers.destination'),
        t('mercado.export.headers.port'),
        t('mercado.export.headers.prevRefPrice'),
        t('mercado.export.headers.todayClosePrice'),
        t('mercado.export.headers.variationPct'),
        t('mercado.export.headers.currency'),
      ]

      const excelRows = historicalData.map((row) => [
        row.date,
        getFruitLabel(t, selectedFruit),
        getVarietyLabel(t, selectedVariety),
        getCountryLabel(t, selectedCountry),
        getPortLabel(t, selectedPort),
        Math.round(row.priceRef * rate * 100) / 100,
        Math.round(row.priceClose * rate * 100) / 100,
        Math.round(row.variation * 100) / 100,
        selectedCurrency,
      ])

      await exportStyledReportExcel({
        sheetName: t('mercado.export.sheetName'),
        title: t('mercado.export.title'),
        moduleLabel: t('mercado.export.moduleLabel'),
        filename: `mercado-precios-fob-${new Date().toISOString().slice(0, 10)}.xlsx`,
        headers,
        rows: excelRows,
        instructions: [
          t('mercado.export.instructions.currency'),
          t('mercado.export.instructions.variation'),
          t('mercado.export.instructions.sources'),
        ],
        summary: t('mercado.export.summary', {
          count: excelRows.length,
          fruit: getFruitLabel(t, selectedFruit),
          variety: getVarietyLabel(t, selectedVariety),
          country: getCountryLabel(t, selectedCountry),
          port: getPortLabel(t, selectedPort),
          currency: selectedCurrency,
        }),
        numericColumns: [6, 7, 8],
        columnWidths: [14, 14, 16, 14, 18, 18, 18, 14, 10],
      })
    } finally {
      setExporting(false)
    }
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
                {t('mercado.title')}
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('mercado.sourcesTooltip.ariaLabel')}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors w-6 h-6"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  <div className="space-y-2">
                    <p className="font-semibold">{t('mercado.sourcesTooltip.heading')}</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>{t('mercado.sourcesTooltip.nationalMarket')}</li>
                      <li>{t('mercado.sourcesTooltip.northAmericanMarket')}</li>
                      <li>{t('mercado.sourcesTooltip.currencies')}</li>
                    </ul>
                    <p className="opacity-80">
                      {t('mercado.sourcesTooltip.note')}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('mercado.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-slate-50 dark:bg-[#0B0F19] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('mercado.filters.title')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Filter 1: Fruit */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t('mercado.filters.fruit')}
            </label>
            <select
              value={selectedFruit}
              onChange={(e) => handleFruitChange(e.target.value as FruitKey)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {FRUIT_KEYS.map((fruit) => (
                <option key={fruit} value={fruit}>
                  {getFruitLabel(t, fruit)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Variety (dependent on Fruit) */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t('mercado.filters.variety')}
            </label>
            <select
              value={selectedVariety}
              onChange={(e) => setSelectedVariety(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {availableVarieties.map((variety) => (
                <option key={variety} value={variety}>
                  {getVarietyLabel(t, variety)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Destination Country */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t('mercado.filters.destinationCountry')}
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => handleCountryChange(e.target.value as CountryKey)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {COUNTRY_KEYS.map((country) => (
                <option key={country} value={country}>
                  {getCountryLabel(t, country)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: Destination Port (dependent on Country) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('mercado.filters.destinationPort')}
              </label>
              {autoSelectedPort && (
                <span className="text-[10px] font-semibold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {t('mercado.filters.autoPortBadge')}
                </span>
              )}
            </div>
            <select
              value={selectedPort}
              onChange={(e) => {
                setSelectedPort(e.target.value as PortKey)
                setAutoSelectedPort(false)
              }}
              disabled={!selectedCountry}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!selectedCountry && <option>{t('mercado.filters.selectCountryFirst')}</option>}
              {availablePorts.map((port) => (
                <option key={port} value={port}>
                  {getPortLabel(t, port)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 5: Currency */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t('mercado.filters.currency')}
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {getCurrencyLabel(t, code)}
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
                {getFruitLabel(t, selectedFruit)} - {getVarietyLabel(t, selectedVariety)}
              </p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {formatPrice(latestData.priceClose, selectedCurrency)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('mercado.summary.fobPricePerKg', {
                  country: getCountryLabel(t, selectedCountry),
                  port: getPortLabel(t, selectedPort),
                })}
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
              <span className="text-xs opacity-75">{t('mercado.summary.vsYesterday')}</span>
            </div>
          </div>
      </DashboardCard>

      {/* Port Map Section */}
      <DashboardCard
        header={
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('mercado.sections.portMap')}</h3>
          </div>
        }
      >
          <PortMap key={selectedPort} selectedPort={getPortMapLookupLabel(selectedPort)} />
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
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('mercado.sections.priceHistory')}</h3>
              </div>
              <button
                type="button"
                onClick={() => void handleExportExcel()}
                disabled={exporting || historicalData.length === 0}
                className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {exporting ? t('mercado.export.generating') : t('mercado.export.button')}
              </button>
            </div>
          }
        >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">{t('mercado.table.date')}</th>
                    <th className="text-left py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">{t('mercado.table.variety')}</th>
                    <th className="text-left py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">{t('mercado.table.destination')}</th>
                    <th className="text-right py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">{t('mercado.table.prevRefPrice')}</th>
                    <th className="text-right py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">{t('mercado.table.todayClosePrice')}</th>
                    <th className="text-right py-3 px-2 font-semibold text-slate-600 dark:text-slate-300">{t('mercado.table.variationPct')}</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-2 text-slate-700 dark:text-slate-300">{row.date}</td>
                      <td className="py-3 px-2 text-slate-700 dark:text-slate-300">{getVarietyLabel(t, selectedVariety)}</td>
                      <td className="py-3 px-2 text-slate-500 dark:text-slate-400 text-xs">{getCountryLabel(t, selectedCountry)}</td>
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
              {t('mercado.table.disclaimer')}
            </p>
        </DashboardCard>

        {/* News Panel */}
        <DashboardCard
          header={
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('mercado.news.title')}</h3>
            </div>
          }
          contentClassName="space-y-4"
        >
            {newsLoading ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('mercado.news.loading')}</p>
              </div>
            ) : newsError ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-600 dark:text-red-400">{t('mercado.news.error')}</p>
              </div>
            ) : marketNews.length > 0 ? (
              marketNews.map((news, idx) => {
                const timeStr = formatMercadoNewsDate(news.pubDate, locale)
                
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
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('mercado.news.empty')}</p>
              </div>
            )}
        </DashboardCard>
      </div>

      {/* Chart Section */}
      <DashboardCard
        header={
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('mercado.chart.title', {
                fruit: getFruitLabel(t, selectedFruit),
                variety: getVarietyLabel(t, selectedVariety),
              })}
            </h3>
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
                {t('mercado.chart.modeByMonth')}
              </label>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <input
                  type="radio"
                  name="timeMode"
                  checked={useCustomRange}
                  onChange={() => setUseCustomRange(true)}
                  className="mr-1"
                />
                {t('mercado.chart.modeCustomRange')}
              </label>
            </div>

            {!useCustomRange ? (
              <div className="grid grid-cols-2 gap-3">
                {/* Year Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('mercado.chart.year')}
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
                    {t('mercado.chart.month')}
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const).map((month) => (
                      <option key={month} value={month}>
                        {t(`mercado.months.${month}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Date From */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('mercado.chart.from')}
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
                    {t('mercado.chart.to')}
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
                  name={`${getFruitLabel(t, selectedFruit)} ${getVarietyLabel(t, selectedVariety)}`}
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
