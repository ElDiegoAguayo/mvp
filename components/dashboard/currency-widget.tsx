'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  DollarSign,
  Euro,
  Banknote,
  CircleDollarSign,
  AlertCircle,
  RefreshCw,
  Calculator,
  ArrowRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface MindicadorResponse {
  dolar?: { valor: number }
  euro?: { valor: number }
  uf?: { valor: number }
}

interface GlobalRatesResponse {
  result: string
  rates: Record<string, number>
}

const FORMATTER_CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Parser for Chilean number format (dots for thousands, comma for decimals)
const parseChileanNumber = (str: string): number => {
  if (!str) return 0
  // Remove all dots (thousands separator) and replace comma with dot (decimal separator)
  const cleanStr = String(str).replace(/\./g, '').replace(/,/g, '.')
  return parseFloat(cleanStr) || 0
}

function formatCLP(value: number) {
  try {
    return FORMATTER_CLP.format(value)
  } catch {
    return `$${value.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

// Popular currencies for the selector (ordered by relevance for Chilean agro)
const POPULAR_CURRENCIES = [
  { code: 'USD', name: 'Dólar USA', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'CNY', name: 'Yuan Chino', symbol: '¥' },
  { code: 'JPY', name: 'Yen Japonés', symbol: '¥' },
  { code: 'BRL', name: 'Real Brasileño', symbol: 'R$' },
  { code: 'ARS', name: 'Peso Argentino', symbol: '$' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£' },
  { code: 'CAD', name: 'Dólar Canadiense', symbol: '$' },
  { code: 'AUD', name: 'Dólar Australiano', symbol: '$' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: '$' },
]

export function CurrencyWidget() {
  const [mindicadorData, setMindicadorData] = useState<MindicadorResponse | null>(null)
  const [globalRates, setGlobalRates] = useState<GlobalRatesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Calculator state
  const [montoCLP, setMontoCLP] = useState<string>('10000')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')

  const fetchAll = async () => {
    setLoading(true)
    setError(null)

    try {
      const [mindicadorRes, globalRes] = await Promise.all([
        fetch('https://mindicador.cl/api'),
        fetch('https://open.er-api.com/v6/latest/CLP'),
      ])

      if (!mindicadorRes.ok) throw new Error('Error cargando datos de mindicador.cl')
      if (!globalRes.ok) throw new Error('Error cargando tasas globales')

      const [mindicadorJson, globalJson] = await Promise.all([
        mindicadorRes.json() as Promise<MindicadorResponse>,
        globalRes.json() as Promise<GlobalRatesResponse>,
      ])

      setMindicadorData(mindicadorJson)
      setGlobalRates(globalJson)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  // Calculate CLP value of foreign currencies (inverted from global rates)
  const eurInCLP = useMemo(() => {
    if (!globalRates?.rates?.EUR) return null
    return 1 / globalRates.rates.EUR
  }, [globalRates])

  const cnyInCLP = useMemo(() => {
    if (!globalRates?.rates?.CNY) return null
    return 1 / globalRates.rates.CNY
  }, [globalRates])

  // Calculate conversion result using Mindicador's official USD rate
  const conversionResult = useMemo(() => {
    // Parse input using Chilean number format
    const amount = parseChileanNumber(montoCLP)
    if (isNaN(amount) || amount <= 0) return null

    // Get the current USD rate from Mindicador (official Chilean rate)
    const currentRate = mindicadorData?.dolar?.valor
    if (!currentRate || currentRate <= 0) return null

    let result = 0
    
    // If converting TO USD, divide by rate. If converting FROM USD, multiply by rate.
    // For now we assume CLP to selectedCurrency conversion
    if (selectedCurrency === 'USD') {
      // CLP to USD: divide by rate (rate is how many CLP per 1 USD)
      result = amount / currentRate
    } else {
      // For other currencies, use global rates if available as fallback
      // This keeps compatibility with other currencies
      const globalRate = globalRates?.rates?.[selectedCurrency]
      if (globalRate && globalRate > 0) {
        // Convert CLP to USD first, then USD to other currency
        const usdAmount = amount / currentRate
        result = usdAmount / globalRate
      } else {
        return null
      }
    }

    console.log('[v0] Conversion debug:', { amount, rate: currentRate, selectedCurrency, result })
    
    return result
  }, [montoCLP, selectedCurrency, mindicadorData, globalRates])

  // Format the result with appropriate currency symbol - apply .toFixed(2) ONLY at render time
  const formatConversionResult = (value: number, currency: string) => {
    const info = POPULAR_CURRENCIES.find((c) => c.code === currency)
    const symbol = info?.symbol ?? ''

    // JPY doesn't use decimals
    if (currency === 'JPY') {
      return `${symbol}${Math.round(value).toLocaleString('es-CL')}`
    }

    // For all other currencies: apply .toFixed(2) to ensure exactly 2 decimals
    const formattedValue = parseFloat(value.toFixed(2))
    
    return `${symbol}${formattedValue.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const cardItems = [
    {
      label: 'Dólar',
      icon: DollarSign,
      value: mindicadorData?.dolar?.valor,
      source: 'mindicador',
    },
    {
      label: 'UF',
      icon: Banknote,
      value: mindicadorData?.uf?.valor,
      source: 'mindicador',
    },
    {
      label: 'Euro',
      icon: Euro,
      value: eurInCLP,
      source: 'er-api',
    },
    {
      label: 'Yuan CNY',
      icon: CircleDollarSign,
      value: cnyInCLP,
      source: 'er-api',
    },
  ]

  return (
    <DashboardCard
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Divisas Globales</h3>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-gray-500 font-mono">
            mindicador + er-api
          </span>
        </div>
      }
      contentClassName="space-y-4"
    >

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {/* 4 currency cards grid */}
          <div className="grid grid-cols-2 gap-2">
            {cardItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="bg-secondary/50 border border-border rounded-lg p-3 flex flex-col"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-base font-bold text-primary font-mono">
                    {typeof item.value === 'number' ? formatCLP(item.value) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Global converter */}
          <div className="border-t border-border pt-3 mt-1">
            <div className="flex items-center gap-1.5 mb-3">
              <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Conversor Global
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Monto CLP"
                  value={montoCLP}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.,]/g, '')
                    setMontoCLP(v)
                  }}
                  className="pl-7 bg-secondary border-border h-9 text-sm"
                />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-[110px] bg-secondary border-border h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POPULAR_CURRENCIES.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.code} - {curr.name.split(' ')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {conversionResult !== null && (
              <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-xs text-muted-foreground mb-1">Resultado</p>
                <p className="text-xl font-bold text-primary">
                  {formatConversionResult(conversionResult, selectedCurrency)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {POPULAR_CURRENCIES.find((c) => c.code === selectedCurrency)?.name}
                </p>
                {selectedCurrency === 'USD' && mindicadorData?.dolar?.valor && (
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-2">
                    Tasa API aplicada: ${mindicadorData.dolar.valor.toFixed(2)} CLP
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </DashboardCard>
  )
}
