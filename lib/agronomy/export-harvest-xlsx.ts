import { exportStyledReportExcel } from '@/lib/excel/upcrop-excel-theme'

export interface HarvestExportRow {
  field_name: string | null
  crop: string
  variety: string | null
  block_name: string
  season_label: string
  record_date: string | null
  hectares: number | null
  fruits_set: number | null
  kg_per_plant: number | null
  kg_per_ha: number | null
  estimated_kg: number
  harvested_kg: number
  count_state: string | null
  status: string
}

const HEADERS = [
  'Campo',
  'Especie',
  'Variedad',
  'Cuartel',
  'Superficie (ha)',
  'Frutos cuajados',
  'Kg/Planta',
  'Kg/ha',
  'Kg Totales',
  'Kg cosechados',
  'Estado cosecha',
  'Estado conteo',
  'Temporada',
  'Fecha registro',
]

export async function exportHarvestToExcel(rows: HarvestExportRow[], seasonLabel?: string): Promise<void> {
  if (rows.length === 0) return

  const season = seasonLabel ?? rows[0]?.season_label ?? 'export'
  const totalKg = rows.reduce((s, r) => s + Number(r.estimated_kg ?? 0), 0)

  await exportStyledReportExcel({
    sheetName: `Estimación ${season}`,
    title: 'ESTIMACIÓN DE COSECHA',
    moduleLabel: 'Estimación de Cosecha',
    filename: `estimacion-cosecha-${season.replace(/\s+/g, '')}.xlsx`,
    headers: HEADERS,
    instructions: [
      '1. Revise cuarteles por variedad y compare Kg Totales vs Kg cosechados.',
      '2. Use el estado de cosecha y conteo para priorizar visitas a campo.',
      '3. Los totales al final resumen la temporada exportada.',
    ],
    summary: `Resumen: ${rows.length} registro${rows.length !== 1 ? 's' : ''} · Temporada ${season} · Kg totales estimados: ${totalKg.toLocaleString('es-CL')} kg`,
    numericColumns: [5, 6, 7, 8, 9, 10],
    columnWidths: [16, 14, 16, 14, 14, 14, 12, 12, 14, 14, 14, 14, 12, 14],
    rows: rows.map((r) => [
      r.field_name ?? '',
      r.crop,
      r.variety ?? '',
      r.block_name,
      r.hectares,
      r.fruits_set,
      r.kg_per_plant,
      r.kg_per_ha,
      r.estimated_kg,
      r.harvested_kg,
      r.status,
      r.count_state ?? '',
      r.season_label,
      r.record_date ?? '',
    ]),
  })
}
