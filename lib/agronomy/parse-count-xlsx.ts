import * as XLSX from 'xlsx'
import type { ParsedHarvestBlock, ParsedHarvestEstimate, ParsedHarvestImport } from './parse-harvest-xlsx'
import {
  COUNT_COL_ALIASES,
  cell,
  mapHeaders,
  normalizeFruitSetPct,
  num,
  parseCountState,
  seasonFromSheetName,
  str,
} from './harvest-xlsx-shared'
import { isBellavistaDashboardWorkbook, parseBellavistaDashboardWorkbook } from './parse-bellavista-dashboard-xlsx'

export { isBellavistaDashboardWorkbook } from './parse-bellavista-dashboard-xlsx'
export { computeKgFromCount } from './aggregate-count-rows'

const COUNT_SHEET_RE = /conteo|estimaci[oó]n.*cosecha|cosecha/i

function hasAnyCountMetric(row: unknown[], col: Record<string, number>): boolean {
  return [
    'dardos_per_plant',
    'dardos_per_branch',
    'dardo_coral',
    'primordia_per_dardo',
    'primordia_per_branch',
    'fruit_set_pct',
    'fruits_set',
    'plants_per_ha',
    'fruit_weight_kg',
  ].some((key) => num(cell(row, col, key)) != null)
}

function parseCountRowRaw(
  row: unknown[],
  col: Record<string, number>,
  season_label: string,
  carry: { field_name: string; block_name: string; variety: string; hectares: number | null },
): ParsedHarvestEstimate | null {
  const field_name = str(cell(row, col, 'field_name')) || carry.field_name
  const block_name = str(cell(row, col, 'block_name')) || carry.block_name
  const variety = str(cell(row, col, 'variety')) || carry.variety

  if (!field_name || !block_name) return null

  const hectares = num(cell(row, col, 'hectares')) ?? carry.hectares
  if (!hasAnyCountMetric(row, col) && (hectares == null || hectares <= 0)) return null

  const parsed: ParsedHarvestEstimate = {
    field_name,
    block_name,
    crop: str(cell(row, col, 'crop')) || 'Cerezo',
    variety,
    season_label: str(cell(row, col, 'season_label')) || season_label,
    hectares: hectares ?? 0,
    plants_per_ha: num(cell(row, col, 'plants_per_ha')),
    dardos_per_plant: num(cell(row, col, 'dardos_per_plant')),
    dardos_per_branch: num(cell(row, col, 'dardos_per_branch')),
    dardo_coral: num(cell(row, col, 'dardo_coral')),
    hilera: num(cell(row, col, 'hilera')),
    arbol: num(cell(row, col, 'arbol')),
    primordia_per_dardo: num(cell(row, col, 'primordia_per_dardo')),
    primordia_per_branch: num(cell(row, col, 'primordia_per_branch')),
    fruit_set_pct: normalizeFruitSetPct(num(cell(row, col, 'fruit_set_pct'))),
    fruits_set: num(cell(row, col, 'fruits_set')),
    fruit_weight_kg: num(cell(row, col, 'fruit_weight_kg')),
    kg_per_plant: null,
    kg_per_ha: null,
    estimated_kg: 0,
    count_state: parseCountState(cell(row, col, 'count_state')) ?? 'Pre-poda',
  }

  return parsed
}

export function parseCountWorkbook(buffer: ArrayBuffer): ParsedHarvestImport {
  const wb = XLSX.read(buffer, { type: 'array' })
  if (isBellavistaDashboardWorkbook(wb)) {
    return parseBellavistaDashboardWorkbook(buffer)
  }
  return parseStandardCountWorkbook(buffer)
}

function parseStandardCountWorkbook(buffer: ArrayBuffer): ParsedHarvestImport {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName =
    wb.SheetNames.find((n) => /conteo/i.test(n))
    ?? wb.SheetNames.find((n) => COUNT_SHEET_RE.test(n))
    ?? wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
  if (rows.length < 2) throw new Error('El Excel no tiene filas de datos')

  const col = mapHeaders(rows[0] as unknown[], COUNT_COL_ALIASES)
  if (col.field_name === undefined || col.block_name === undefined) {
    throw new Error('Debe incluir columnas Campo y Cuartel.')
  }

  const season_label = seasonFromSheetName(sheetName)
  const rawRows: ParsedHarvestEstimate[] = []
  const carry = { field_name: '', block_name: '', variety: '', hectares: null as number | null }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const field = str(cell(row, col, 'field_name'))
    const block = str(cell(row, col, 'block_name'))
    const variety = str(cell(row, col, 'variety'))
    const ha = num(cell(row, col, 'hectares'))

    if (field) carry.field_name = field
    if (block) carry.block_name = block
    if (variety) carry.variety = variety
    if (ha != null && ha > 0) carry.hectares = ha

    const parsed = parseCountRowRaw(row, col, season_label, carry)
    if (parsed) rawRows.push(parsed)
  }

  if (rawRows.length === 0) {
    throw new Error('No se encontraron filas de conteo válidas (Campo, Cuartel y datos de conteo).')
  }

  const estimates = rawRows

  if (estimates.length === 0) {
    throw new Error('No se encontraron filas de conteo válidas (Campo, Cuartel y datos de conteo).')
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
    source_row_count: rawRows.length,
  }
}
