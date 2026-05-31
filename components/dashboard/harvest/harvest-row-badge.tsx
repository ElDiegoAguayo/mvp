'use client'

import { Badge } from '@/components/ui/badge'
import { Calculator, Database } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

export function isComputedHarvestRow(id: string): boolean {
  return id.startsWith('computed-')
}

export function HarvestRowBadge({ rowId }: { rowId: string }) {
  const { t } = useLocale()

  if (isComputedHarvestRow(rowId)) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] shrink-0">
        <Calculator className="w-3 h-3 mr-1" /> {t('estimacionCosecha.badges.computed')}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] shrink-0">
      <Database className="w-3 h-3 mr-1" /> {t('estimacionCosecha.badges.saved')}
    </Badge>
  )
}
