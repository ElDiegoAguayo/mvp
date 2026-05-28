import { buildCountGroupAverages, countGroupKey } from './count-group-averages'
import { exportStyledReportExcel } from '@/lib/excel/upcrop-excel-theme'

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
  'Árbol',
  'Dardos/planta',
  'Ramillas/dardo',
  'Dardo coral',
  'Prom. árbol',
  'Prom. dardos',
  'Prom. ramillas',
  'Prom. dardo coral',
  'Estado conteo',
]

function fmtVal(v: number | null | undefined): number | string {
  if (v == null || !Number.isFinite(Number(v))) return ''
  return Math.round(Number(v) * 100) / 100
}

function fmtAvgCell(v: number | null | undefined): number | string {
  if (v == null || !Number.isFinite(Number(v))) return ''
  return Math.round(Number(v) * 100) / 100
}

export async function exportCountToExcel(rows: CountExportRow[], seasonLabel?: string): Promise<void> {
  if (rows.length === 0) return

  const avgs = buildCountGroupAverages(rows)
  const season = seasonLabel ?? rows[0]?.season_label ?? 'export'
  const cuarteles = new Set(rows.map((r) => r.block_name)).size

  await exportStyledReportExcel({
    sheetName: `Conteo ${season}`,
    title: 'CONTEO DE COSECHA',
    moduleLabel: 'Estimación de Cosecha — Conteo',
    filename: `conteo-cosecha-${season.replace(/\s+/g, '')}.xlsx`,
    headers: HEADERS,
    instructions: [
      '1. Cada fila es un árbol o muestra de conteo en campo.',
      '2. Las columnas Prom. muestran promedios del grupo cuartel + variedad.',
      '3. Use el estado de conteo para filtrar muestras Pre/Post en la plataforma.',
    ],
    summary: `Resumen: ${rows.length} muestra${rows.length !== 1 ? 's' : ''} · ${cuarteles} cuartel${cuarteles !== 1 ? 'es' : ''} · Temporada ${season}`,
    numericColumns: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    columnWidths: [16, 14, 16, 10, 10, 12, 12, 12, 12, 12, 12, 14, 14],
    rows: rows.map((r) => {
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
  })
}
