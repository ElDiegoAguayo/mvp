'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2 } from 'lucide-react'
import { formatKg } from '@/lib/agronomy/format'
import type { HarvestCountState } from '@/lib/agronomy/cherry-harvest-formula'
import { HarvestRowBadge } from '@/components/dashboard/harvest/harvest-row-badge'
import { useLocale } from '@/components/i18n/locale-provider'

export interface HarvestEstimationCardRow {
  id: string
  field_name: string | null
  block_name: string
  variety: string | null
  crop: string
  hectares: number | null
  estimated_kg: number
  count_state: HarvestCountState | null
  kg_per_ha: number | null
}

interface HarvestEstimationCardsProps {
  rows: HarvestEstimationCardRow[]
  countStyle: Record<HarvestCountState, string>
  onEdit?: (row: HarvestEstimationCardRow) => void
  onDelete?: (row: HarvestEstimationCardRow) => void
  readOnly?: boolean
}

function tCountState(t: (k: string) => string, state: HarvestCountState) {
  return state === 'Post-poda'
    ? t('estimacionCosecha.countState.postPoda')
    : t('estimacionCosecha.countState.prePoda')
}

export function HarvestEstimationCards({
  rows,
  countStyle,
  onEdit,
  onDelete,
  readOnly = false,
}: HarvestEstimationCardsProps) {
  const { t } = useLocale()

  if (rows.length === 0) return null

  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => {
        const countState = (row.count_state ?? 'Pre-poda') as HarvestCountState
        const canDelete = !row.id.startsWith('computed-')
        return (
          <div key={row.id} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{row.block_name}</p>
                <p className="text-xs text-muted-foreground">{row.field_name ?? '—'} · {row.variety ?? row.crop}</p>
              </div>
              <HarvestRowBadge rowId={row.id} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('estimacionCosecha.cards.estimatedKg')}</p>
                <p className="font-bold text-primary">{formatKg(Number(row.estimated_kg))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('estimacionCosecha.cards.area')}</p>
                <p className="font-medium">{row.hectares ?? '—'} {t('common.units.ha')}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className={countStyle[countState]}>{tCountState(t, countState)}</Badge>
              {!readOnly && onEdit && onDelete && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(row)} title={t('common.actions.edit')}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => onDelete(row)} title={t('common.actions.delete')}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
