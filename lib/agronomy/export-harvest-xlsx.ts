import * as XLSX from 'xlsx'

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
  'Superficie Total Cuartel',
  'Frutos cuajados',
  'Kg/Planta',
  'Kg/ha',
  'Kg Totales',
  'Kg cosechados',
  'Estado cosecha',
  'Estado conteo',
  'Temporada',
  'Fecha',
]

export function exportHarvestToExcel(rows: HarvestExportRow[], seasonLabel?: string): void {
  if (rows.length === 0) return

  const season = seasonLabel ?? rows[0]?.season_label ?? 'export'
  const sheetRows = [
    HEADERS,
    ...rows.map((r) => [
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
  ]

  const ws = XLSX.utils.aoa_to_sheet(sheetRows)
  const wb = XLSX.utils.book_new()
  const sheetName = `Estimacion de Cosecha ${season}`.slice(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `estimacion-cosecha-${season.replace(/\s+/g, '')}.xlsx`)
}
