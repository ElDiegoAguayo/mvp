import * as XLSX from 'xlsx'
import { buildCountGroupAverages, countGroupKey } from './count-group-averages'

export interface CountExportRow {
  field_name: string | null
  block_name: string
  variety: string | null
  hilera?: number | null
  arbol?: number | null
  dardos_per_plant: number | null
  dardos_per_branch: number | null
  dardo_coral: number | null
  count_state: string | null
  season_label?: string
  record_date?: string | null
}

const HEADERS = [
  'Campo',
  'Cuartel',
  'Variedad',
  'Hilera',
  'Arbol',
  'Dardo',
  'Ramillas',
  'Dardo Coral',
  'Prom. Arbol',
  'Prom. Dardo',
  'Prom. Ramillas',
  'Prom. Dardo Coral',
  'Estado',
]

function fmtVal(v: number | null | undefined): number | string {
  if (v == null || !Number.isFinite(Number(v))) return ''
  return Math.round(Number(v) * 100) / 100
}

function fmtAvgCell(v: number | null | undefined): number | string {
  if (v == null || !Number.isFinite(Number(v))) return ''
  return Math.round(Number(v) * 100) / 100
}

export function exportCountToExcel(rows: CountExportRow[], seasonLabel?: string): void {
  if (rows.length === 0) return

  const avgs = buildCountGroupAverages(rows)
  const season = seasonLabel ?? rows[0]?.season_label ?? 'export'
  const sheetRows = [
    HEADERS,
    ...rows.map((r) => {
      const avg = avgs.get(countGroupKey(r))
      return [
        r.field_name ?? '',
        r.block_name,
        r.variety ?? '',
        r.hilera ?? '',
        r.arbol ?? '',
        fmtVal(r.dardos_per_plant),
        fmtVal(r.dardos_per_branch),
        fmtVal(r.dardo_coral),
        fmtAvgCell(avg?.arbol),
        fmtAvgCell(avg?.dardos_per_plant),
        fmtAvgCell(avg?.dardos_per_branch),
        fmtAvgCell(avg?.dardo_coral),
        r.count_state ?? '',
      ]
    }),
  ]

  const ws = XLSX.utils.aoa_to_sheet(sheetRows)
  const wb = XLSX.utils.book_new()
  const sheetName = `Conteo ${season}`.slice(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `conteo-cosecha-${season.replace(/\s+/g, '')}.xlsx`)
}
