import * as XLSX from 'xlsx'
import { isBellavistaDashboardWorkbook } from './parse-bellavista-dashboard-xlsx'
import { currentSeasonLabel } from './format'
import type { HarvestCountState } from './cherry-harvest-formula'
import {
  ESTIMATION_COL_ALIASES,
  cell,
  mapHeaders,
  normalizeFruitSetPct,
  num,
  parseCountState,
  seasonFromSheetName,
  str,
} from './harvest-xlsx-shared'

export interface ParsedHarvestEstimate {
  field_name: string
  block_name: string
  crop: string
  variety: string
  season_label: string
  hectares: number
  plants_per_ha: number | null
  dardos_per_plant: number | null
  dardos_per_branch: number | null
  dardo_coral: number | null
  hilera: number | null
  arbol: number | null
  is_count_summary?: boolean
  /** Muestras (árboles) promediadas al importar conteo */
  count_sample_count?: number | null
  primordia_per_dardo: number | null
  primordia_per_branch: number | null
  fruit_set_pct: number | null
  fruits_set: number | null
  fruit_weight_kg: number | null
  kg_per_plant: number | null
  kg_per_ha: number | null
  estimated_kg: number
  harvested_kg?: number | null
  count_state: HarvestCountState | null
}

export interface ParsedHarvestBlock {
  field_name: string
  block_name: string
  crop: string
  variety: string | null
  hectares: number | null
  plants_per_ha: number | null
}

export interface ParsedHarvestImport {
  sheetName: string
  season_label: string
  fields: string[]
  blocks: ParsedHarvestBlock[]
  estimates: ParsedHarvestEstimate[]
  /** Filas leídas antes de promediar (solo conteo) */
  source_row_count?: number
}

const ESTIMATE_SHEET_RE = /estimaci[oó]n.*cosecha|cosecha/i

function parseEstimationRow(
  row: unknown[],
  col: Record<string, number>,
  season_label: string,
): ParsedHarvestEstimate | null {
  const field_name = str(cell(row, col, 'field_name'))
  const block_name = str(cell(row, col, 'block_name'))
  if (!field_name || !block_name) return null

  const hectares = num(cell(row, col, 'hectares'))
  if (hectares == null || hectares <= 0) return null

  let estimated_kg = num(cell(row, col, 'estimated_kg'))
  const kg_per_ha = num(cell(row, col, 'kg_per_ha'))
  if (estimated_kg == null && kg_per_ha != null) {
    estimated_kg = kg_per_ha * hectares
  }
  if (estimated_kg == null) return null

  const kg_per_plant = num(cell(row, col, 'kg_per_plant'))

  return {
    field_name,
    block_name,
    crop: str(cell(row, col, 'crop')) || 'Cerezo',
    variety: str(cell(row, col, 'variety')),
    season_label: str(cell(row, col, 'season_label')) || season_label,
    hectares,
    plants_per_ha: num(cell(row, col, 'plants_per_ha')),
    dardos_per_plant: num(cell(row, col, 'dardos_per_plant')),
    dardos_per_branch: num(cell(row, col, 'dardos_per_branch')),
    primordia_per_dardo: num(cell(row, col, 'primordia_per_dardo')),
    primordia_per_branch: num(cell(row, col, 'primordia_per_branch')),
    fruit_set_pct: normalizeFruitSetPct(num(cell(row, col, 'fruit_set_pct'))),
    fruits_set: num(cell(row, col, 'fruits_set')),
    fruit_weight_kg: num(cell(row, col, 'fruit_weight_kg')),
    kg_per_plant,
    kg_per_ha: kg_per_ha ?? (kg_per_plant != null && num(cell(row, col, 'plants_per_ha'))
      ? kg_per_plant * Number(cell(row, col, 'plants_per_ha'))
      : estimated_kg / hectares),
    estimated_kg,
    harvested_kg: num(cell(row, col, 'harvested_kg')),
    count_state: parseCountState(cell(row, col, 'count_state')),
  }
}

export function parseHarvestWorkbook(buffer: ArrayBuffer): ParsedHarvestImport {
  const wb = XLSX.read(buffer, { type: 'array' })

  if (isBellavistaDashboardWorkbook(wb)) {
    throw new Error(
      'Este archivo es de conteo fenológico (Campo, Cuartel, Dardo, Ramillas). Impórtalo desde la pestaña Conteo.',
    )
  }

  const sheetName =
    wb.SheetNames.find((n) => ESTIMATE_SHEET_RE.test(n))
    ?? wb.SheetNames.find((n) => /cosecha/i.test(n))
    ?? wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
  if (rows.length < 2) {
    throw new Error('El Excel no tiene filas de datos')
  }

  const col = mapHeaders(rows[0] as unknown[], ESTIMATION_COL_ALIASES)
  if (col.field_name === undefined || col.block_name === undefined) {
    throw new Error(
      'No se encontró la hoja de estimación. Debe incluir columnas Campo y Cuartel.',
    )
  }

  const season_label = seasonFromSheetName(sheetName)
  const estimates: ParsedHarvestEstimate[] = []

  for (let i = 1; i < rows.length; i++) {
    const parsed = parseEstimationRow(rows[i] as unknown[], col, season_label)
    if (parsed) estimates.push(parsed)
  }

  if (estimates.length === 0) {
    throw new Error('No se encontraron filas válidas con Campo, Cuartel y Kg totales.')
  }

  const fields = [...new Set(estimates.map((e) => e.field_name))].sort()

  const blockMap = new Map<string, ParsedHarvestBlock>()
  for (const e of estimates) {
    const key = `${e.field_name}::${e.block_name}`
    if (!blockMap.has(key)) {
      blockMap.set(key, {
        field_name: e.field_name,
        block_name: e.block_name,
        crop: e.crop,
        variety: e.variety || null,
        hectares: e.hectares,
        plants_per_ha: e.plants_per_ha,
      })
    }
  }

  return {
    sheetName,
    season_label,
    fields,
    blocks: [...blockMap.values()],
    estimates,
  }
}

// Compat: importación completa (conteo + estimación en una hoja)
export { parseCountWorkbook } from './parse-count-xlsx'
