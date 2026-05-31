'use client'

import { HardHat } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

export type TechAssistancePageRole = 'inspector' | 'admin' | 'client'

interface TechAssistancePageHeaderProps {
  role: TechAssistancePageRole
}

export function TechAssistancePageHeader({ role }: TechAssistancePageHeaderProps) {
  const { t } = useLocale()

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <HardHat className="w-6 h-6 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('asistenciaTecnica.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t(`asistenciaTecnica.subtitles.${role}`)}
          </p>
        </div>
      </div>
    </div>
  )
}
