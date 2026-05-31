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
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { useLocale } from '@/components/i18n/locale-provider'
import { translateCurrencyName } from '@/lib/i18n/translate'
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

const POPULAR_CURRENCY_CODES = ['USD', 'EUR', 'CNY', 'JPY', 'BRL', 'ARS', 'GBP', 'CAD', 'AUD', 'MXN'] as const

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  CNY: '¥',
  JPY: '¥',
  BRL: 'R$',
  ARS: '$',
  GBP: '£',
  CAD: '$',
  AUD: '$',
  MXN: '$',
}

export function CurrencyWidget() {
  const { t, locale } = useLocale()
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

      if (!mindicadorRes.ok) throw new Error(t('homeWidgets.currencyErrorMindicador'))
      if (!globalRes.ok) throw new Error(t('homeWidgets.currencyErrorGlobal'))

      const [mindicadorJson, globalJson] = await Promise.all([
        mindicadorRes.json() as Promise<MindicadorResponse>,
        globalRes.json() as Promise<GlobalRatesResponse>,
      ])

      setMindicadorData(mindicadorJson)
      setGlobalRates(globalJson)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('homeWidgets.currencyErrorNetwork'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [t])

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
    const symbol = CURRENCY_SYMBOLS[currency] ?? ''

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
    { label: t('homeWidgets.currencyDollar'), icon: DollarSign, value: mindicadorData?.dolar?.valor, source: 'mindicador' },
    { label: t('homeWidgets.currencyUf'), icon: Banknote, value: mindicadorData?.uf?.valor, source: 'mindicador' },
    { label: t('homeWidgets.currencyEuro'), icon: Euro, value: eurInCLP, source: 'er-api' },
    { label: t('homeWidgets.currencyYuan'), icon: CircleDollarSign, value: cnyInCLP, source: 'er-api' },
  ]

  if (loading) {
    return <WidgetSkeleton />
  }

  return (
    <DashboardCard
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('homeWidgets.currencyTitle')}</h3>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-gray-500 font-mono">
            mindicador + er-api
          </span>
        </div>
      }
      contentClassName="space-y-4"
    >

      {error ? (
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
            {t('homeWidgets.currencyRetry')}
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
                {t('homeWidgets.currencyConverter')}
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
                  placeholder={t('homeWidgets.currencyAmountPlaceholder')}
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
                  {POPULAR_CURRENCY_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code} - {translateCurrencyName(code, locale).split(' ')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {conversionResult !== null && (
              <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-xs text-muted-foreground mb-1">{t('homeWidgets.currencyResult')}</p>
                <p className="text-xl font-bold text-primary">
                  {formatConversionResult(conversionResult, selectedCurrency)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {translateCurrencyName(selectedCurrency, locale)}
                </p>
                {selectedCurrency === 'USD' && mindicadorData?.dolar?.valor && (
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-2">
                    {t('homeWidgets.currencyRateApplied', {
                      rate: mindicadorData.dolar.valor.toFixed(2),
                    })}
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
