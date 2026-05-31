'use client'

import type { PrePostDeltaRow } from '@/lib/agronomy/harvest-pre-post-delta'
import { formatKg } from '@/lib/agronomy/format'
import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/components/i18n/locale-provider'

interface HarvestPrePostTableProps {
  rows: PrePostDeltaRow[]
}

export function HarvestPrePostTable({ rows }: HarvestPrePostTableProps) {
  const { t } = useLocale()

  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="text-sm font-semibold">{t('estimacionCosecha.prePost.title')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('estimacionCosecha.prePost.subtitle')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-3 py-2.5 font-medium">{t('estimacionCosecha.table.field')}</th>
              <th className="px-3 py-2.5 font-medium">{t('estimacionCosecha.table.block')} · {t('estimacionCosecha.table.variety')}</th>
              <th className="px-3 py-2.5 font-medium">{t('estimacionCosecha.prePost.prePoda')}</th>
              <th className="px-3 py-2.5 font-medium">{t('estimacionCosecha.prePost.postPoda')}</th>
              <th className="px-3 py-2.5 font-medium">{t('estimacionCosecha.prePost.variation')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.field_name}-${row.block_name}-${row.variety}`} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2.5 text-muted-foreground">{row.field_name || '—'}</td>
                <td className="px-3 py-2.5 font-medium">{row.label}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatKg(row.preKg)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatKg(row.postKg)}</td>
                <td className="px-3 py-2.5">
                  {row.deltaPct != null ? (
                    <Badge
                      variant="outline"
                      className={
                        row.deltaPct >= 0
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      }
                    >
                      {row.deltaPct >= 0 ? '+' : ''}{row.deltaPct}%
                    </Badge>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
