'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/components/i18n/locale-provider'
import { formatCLP, type TechAssistanceEntry } from '@/lib/tech-assistance/types'
import {
  PLANILLA_PRICE_COLUMN_INDICES,
  entryLocationDisplay,
  entryUnitAmounts,
  formatEntryTime,
  getPlanillaHeaders,
  billingUnitShort,
} from '@/lib/tech-assistance/planilla-format'
import { cn } from '@/lib/utils'

interface TechAssistancePlanillaTableProps {
  entries: TechAssistanceEntry[]
  showPrices?: boolean
  compact?: boolean
  className?: string
}

export function TechAssistancePlanillaTable({
  entries,
  showPrices = true,
  compact = false,
  className,
}: TechAssistancePlanillaTableProps) {
  const { t, locale } = useLocale()
  const headers = getPlanillaHeaders(t)
  const dash = t('asistenciaTecnica.dash')

  if (!entries.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">{t('asistenciaTecnica.planilla.noRecords')}</p>
    )
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border', className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/10 hover:bg-primary/10">
            {headers.map((h, index) => (
              <TableHead
                key={h}
                className={cn(
                  'whitespace-nowrap text-xs font-semibold',
                  !showPrices && PLANILLA_PRICE_COLUMN_INDICES.includes(index) && 'hidden',
                )}
              >
                {h}
              </TableHead>
            ))}
            <TableHead className="text-xs">{t('asistenciaTecnica.planilla.statusColumn')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(entry => {
            const { unitNet, unitIva, unitWithIva } = entryUnitAmounts(entry.unit_price_net)
            const qty = Number(entry.quantity) || 0
            return (
              <TableRow key={entry.id} className={compact ? 'text-xs' : 'text-sm'}>
                <TableCell className="whitespace-nowrap font-medium">{entry.inspector_name}</TableCell>
                <TableCell className="whitespace-nowrap">{entry.work_date}</TableCell>
                <TableCell>{entry.tech_assistance_services?.name ?? dash}</TableCell>
                <TableCell className="max-w-[140px] truncate" title={entryLocationDisplay(entry)}>
                  {entryLocationDisplay(entry) || dash}
                </TableCell>
                <TableCell className="text-center">{Number(entry.attendance_value ?? 1)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatEntryTime(entry.started_at, locale) || dash}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatEntryTime(entry.ended_at, locale) || dash}
                </TableCell>
                <TableCell className="text-right">
                  {entry.regular_hours != null ? Number(entry.regular_hours) : dash}
                </TableCell>
                <TableCell className="text-right">
                  {entry.overtime_hours != null ? Number(entry.overtime_hours) : dash}
                </TableCell>
                <TableCell>{billingUnitShort(entry.billing_unit, locale)}</TableCell>
                <TableCell className="text-right">{qty > 0 ? qty : dash}</TableCell>
                {showPrices && (
                  <>
                    <TableCell className="text-right whitespace-nowrap">
                      {unitNet > 0 ? formatCLP(unitNet) : dash}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {unitNet > 0 ? formatCLP(unitIva) : dash}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {unitNet > 0 ? formatCLP(unitWithIva) : dash}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {qty > 0 ? formatCLP(Number(entry.amount_total)) : dash}
                    </TableCell>
                  </>
                )}
                <TableCell>
                  {entry.proforma_id ? (
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700">
                      {t('asistenciaTecnica.planilla.statusProforma')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      {t('asistenciaTecnica.planilla.statusOpen')}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
