'use client'

import { Package, RefreshCw } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { UMBRAL_CRITICO_PALLETS, UMBRAL_BAJO_PALLETS } from '@/lib/produccion/constants'

interface ProduccionPageHeaderProps {
  critCount: number
  bajCount: number
  showBanner: boolean
}

export function ProduccionPageHeader({ critCount, bajCount, showBanner }: ProduccionPageHeaderProps) {
  const { t } = useLocale()

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{t('produccion.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('produccion.subtitle')}</p>
        </div>

        <a
          href="/dashboard/produccion"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('produccion.refresh')}
        </a>
      </div>

      {showBanner && (critCount > 0 || bajCount > 0) && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200 text-sm">
              {t('produccion.banner.attention', { count: critCount + bajCount })}
            </p>
            <p className="text-xs text-red-700/90 dark:text-red-300/70 mt-0.5">
              {critCount > 0 &&
                `${t('produccion.banner.critical', { count: critCount, threshold: UMBRAL_CRITICO_PALLETS })} · `}
              {bajCount > 0 &&
                t('produccion.banner.low', { count: bajCount, threshold: UMBRAL_BAJO_PALLETS })}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
