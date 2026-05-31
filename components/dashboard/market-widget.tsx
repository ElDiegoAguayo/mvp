'use client'

import { useEffect, useState } from 'react'
import {
  Cherry,
  Grape,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton'
import { useLocale } from '@/components/i18n/locale-provider'

interface MarketRow {
  key: string
  label: string
  Icon: typeof Cherry
  pricePerKg: number
  previousPrice: number
}

/**
 * Mock fetch that simulates a network call to a market export API.
 * Real implementation would hit an internal /api/markets route.
 */
async function fetchMarketsMock(t: (key: string) => string): Promise<MarketRow[]> {
  await new Promise((resolve) => setTimeout(resolve, 600))
  return [
    {
      key: 'cherry',
      label: t('mercado.commodities.cherry'),
      Icon: Cherry,
      pricePerKg: 8.5,
      previousPrice: 8.2,
    },
    {
      key: 'grape',
      label: t('mercado.commodities.tableGrape'),
      Icon: Grape,
      pricePerKg: 2.1,
      previousPrice: 2.25,
    },
  ]
}

export function MarketWidget() {
  const { t } = useLocale()
  const [rows, setRows] = useState<MarketRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchMarketsMock(t)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  if (loading || !rows) {
    return <WidgetSkeleton />
  }

  return (
    <DashboardCard
      header={
        <>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {t('mercado.widget.title')}
            </h3>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            {t('mercado.widget.unit')}
          </span>
        </>
      }
    >
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const Icon = r.Icon
            const diff = r.pricePerKg - r.previousPrice
            const up = diff >= 0
            const pct = (diff / r.previousPrice) * 100
            return (
              <li
                key={r.key}
                className="flex items-center justify-between gap-3 py-1 border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate">
                    {r.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-sm font-semibold text-foreground font-mono">
                    USD ${r.pricePerKg.toFixed(2)}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 text-xs font-medium ${
                      up ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {up ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(pct).toFixed(1)}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
    </DashboardCard>
  )
}
