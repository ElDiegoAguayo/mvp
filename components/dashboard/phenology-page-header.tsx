'use client'

import { Sprout } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

export function PhenologyPageHeader() {
  const { t } = useLocale()

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center">
          <Sprout className="w-6 h-6 text-lime-600 dark:text-lime-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('estadosFenologicos.page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('estadosFenologicos.page.subtitle')}</p>
        </div>
      </div>
    </div>
  )
}
