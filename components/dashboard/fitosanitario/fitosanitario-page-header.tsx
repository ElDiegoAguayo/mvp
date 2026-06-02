'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/i18n/locale-provider'
import { FlaskConical } from 'lucide-react'
import { PhytoImportButton } from '@/components/dashboard/fitosanitario/phyto-import-button'

export function FitosanitarioPageHeader() {
  const { t } = useLocale()
  const router = useRouter()

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-lime-500/10 border border-lime-500/20 flex items-center justify-center shrink-0">
          <FlaskConical className="w-5 h-5 text-lime-600 dark:text-lime-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('fitosanitario.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('fitosanitario.subtitle')}</p>
        </div>
      </div>
      <PhytoImportButton onImported={() => router.refresh()} />
    </div>
  )
}
