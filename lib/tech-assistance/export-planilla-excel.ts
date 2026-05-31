import { exportStyledReportExcel } from '@/lib/excel/upcrop-excel-theme'
import type { Locale } from '@/lib/i18n/config'
import {
  PLANILLA_COLUMN_WIDTHS,
  PLANILLA_NUMERIC_COLUMNS,
  entriesToPlanillaRows,
  getPlanillaHeaders,
  getPlanillaSummary,
} from '@/lib/tech-assistance/planilla-format'
import {
  formatCLP,
  type TechAssistanceEntry,
  type TechAssistanceProforma,
  type TranslateFn,
} from '@/lib/tech-assistance/types'

export async function exportPlanillaExcel(options: {
  entries: TechAssistanceEntry[]
  filename: string
  title: string
  clientLabel?: string
  proforma?: TechAssistanceProforma | null
  t: TranslateFn
  locale: Locale
}): Promise<void> {
  const { entries, filename, title, clientLabel, proforma, t, locale } = options
  if (!entries.length) return

  const instructions = [
    clientLabel ? t('asistenciaTecnica.export.clientLine', { name: clientLabel }) : null,
    proforma
      ? t('asistenciaTecnica.export.proformaLine', {
          number: proforma.proforma_number,
          start: proforma.period_start,
          end: proforma.period_end,
          total: formatCLP(Number(proforma.total_amount)),
        })
      : t('asistenciaTecnica.export.pendingRecords'),
    t('asistenciaTecnica.export.costNote'),
  ].filter(Boolean) as string[]

  await exportStyledReportExcel({
    sheetName: t('asistenciaTecnica.export.sheetName'),
    title,
    moduleLabel: t('asistenciaTecnica.title'),
    filename,
    headers: getPlanillaHeaders(t),
    rows: entriesToPlanillaRows(entries, locale),
    instructions,
    instructionsTitle: t('asistenciaTecnica.export.instructionsTitle'),
    summary: getPlanillaSummary(entries, t),
    columnWidths: PLANILLA_COLUMN_WIDTHS,
    numericColumns: PLANILLA_NUMERIC_COLUMNS,
  })
}
