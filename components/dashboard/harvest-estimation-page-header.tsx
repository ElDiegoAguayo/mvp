'use client'

import { BarChart3 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

export function HarvestEstimationPageHeader() {
  const { t } = useLocale()

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('estimacionCosecha.page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('estimacionCosecha.page.subtitle')}</p>
        </div>
      </div>
    </div>
  )
}
