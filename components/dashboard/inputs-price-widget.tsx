'use client'

import { useMemo, useState } from 'react'
import { Fuel, TrendingUp, TrendingDown } from 'lucide-react'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { useLocale } from '@/components/i18n/locale-provider'
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

const EXCHANGE_RATE_CLP = 940
const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'CLP', symbol: '$', label: 'CLP' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
]

const FUEL_VALUES = [
  { wti: 78.50, brent: 82.30, diesel: 2.85, naturalGas: 3.24 },
  { wti: 78.10, brent: 81.95, diesel: 2.87, naturalGas: 3.19 },
  { wti: 77.80, brent: 81.60, diesel: 2.89, naturalGas: 3.28 },
  { wti: 77.45, brent: 81.20, diesel: 2.91, naturalGas: 3.35 },
  { wti: 77.20, brent: 80.85, diesel: 2.88, naturalGas: 3.42 },
  { wti: 76.95, brent: 80.50, diesel: 2.90, naturalGas: 3.38 },
  { wti: 76.80, brent: 80.20, diesel: 2.92, naturalGas: 3.45 },
]

function formatPrice(value: number, currency: string): string {
  if (currency === 'CLP') {
    return (value * EXCHANGE_RATE_CLP).toFixed(0)
  } else if (currency === 'EUR') {
    return (value / 1.1).toFixed(2)
  }
  return value.toFixed(2)
}

export function InputsPriceWidget() {
  const { t } = useLocale()
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')
  const currencySymbol = CURRENCIES.find(c => c.code === selectedCurrency)?.symbol || '$'

  const dayKeys = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const

  const fuelsData = useMemo(
    () =>
      FUEL_VALUES.map((row, index) => ({
        date: t(`homeWidgets.${dayKeys[index]}`),
        ...row,
      })),
    [t],
  )

  const fuelMetrics = useMemo(
    () => [
      { key: 'wti', name: t('homeWidgets.fuelWti'), unit: t('homeWidgets.unitUsdBarrel'), color: '#60a5fa', dataKey: 'wti' },
      { key: 'brent', name: t('homeWidgets.fuelBrent'), unit: t('homeWidgets.unitUsdBarrel'), color: '#1e40af', dataKey: 'brent' },
      { key: 'diesel', name: t('homeWidgets.fuelDiesel'), unit: t('homeWidgets.unitUsdGallon'), color: '#f97316', dataKey: 'diesel' },
      { key: 'naturalGas', name: t('homeWidgets.fuelGas'), unit: t('homeWidgets.unitUsdMmbtu'), color: '#9ca3af', dataKey: 'naturalGas' },
    ],
    [t],
  )

  const calculateChange = (currentVal: number, previousVal: number) => {
    const change = currentVal - previousVal
    const changePercent = ((change / previousVal) * 100).toFixed(2)
    return { change, changePercent }
  }

  const displayUnit = (unit: string) => {
    if (selectedCurrency !== 'CLP' || !unit.includes('USD/')) return unit
    return unit.replace('USD/', 'CLP/')
  }

  return (
    <DashboardCard
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('homeWidgets.fuelsTitle')}
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
            {CURRENCIES.map((curr) => (
              <button
                key={curr.code}
                onClick={() => setSelectedCurrency(curr.code)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  selectedCurrency === curr.code
                    ? 'bg-primary text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {curr.label}
              </button>
            ))}
          </div>
        </div>
      }
      contentClassName="space-y-4"
    >
      {fuelMetrics.map((metric, idx) => {
        const currentValue = fuelsData[fuelsData.length - 1][metric.dataKey as keyof typeof fuelsData[0]] as number
        const previousValue = fuelsData[0][metric.dataKey as keyof typeof fuelsData[0]] as number
        const { change, changePercent } = calculateChange(currentValue, previousValue)

        return (
          <div key={metric.key} className={idx < fuelMetrics.length - 1 ? 'border-b border-gray-300 dark:border-gray-700 pb-4' : ''}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {metric.name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {currencySymbol}{formatPrice(currentValue, selectedCurrency)}
                </span>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                  change < 0
                    ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                    : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                }`}>
                  {change < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <TrendingUp className="w-3 h-3" />
                  )}
                  <span className="font-semibold">
                    {change < 0 ? '' : '+'}{changePercent}%
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {displayUnit(metric.unit)}
            </p>

            <ResponsiveContainer width="100%" height={40}>
              <LineChart data={fuelsData}>
                <Line
                  type="monotone"
                  dataKey={metric.dataKey}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}

      <div className="text-[10px] text-gray-500 dark:text-gray-600 border-t border-gray-300 dark:border-gray-700 pt-2 mt-2">
        {t('homeWidgets.fuelsSource')}
      </div>
    </DashboardCard>
  )
}
