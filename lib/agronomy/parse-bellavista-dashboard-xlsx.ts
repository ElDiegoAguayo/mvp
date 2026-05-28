import * as XLSX from 'xlsx'
import { getCherryVarietyDefaults } from './cherry-harvest-formula'
import type { ParsedHarvestBlock, ParsedHarvestEstimate, ParsedHarvestImport } from './parse-harvest-xlsx'
import { mapHeaders, num, parseCountState, seasonFromSheetName, str } from './harvest-xlsx-shared'

const DATOS_RESERVADOS_ALIASES: Record<string, string[]> = {
  field_name: ['campo'],
  crop: ['especie'],
  variety: ['variedad'],
  block_name: ['cuartel'],
  hectares: ['superficie total cuartel', 'superficie'],
  plants_per_ha: ['plantas/ha', 'plantas ha'],
}

function parseDatosReservadosBlocks(wb: XLSX.WorkBook): ParsedHarvestBlock[] {
  const sheetName = wb.SheetNames.find((n) => /datos reservados/i.test(n))
  if (!sheetName) return []

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: null })
  if (rows.length < 2) return []

  const col = mapHeaders(rows[0] as unknown[], DATOS_RESERVADOS_ALIASES)
  if (col.field_name == null || col.block_name == null) return []

  const blocks: ParsedHarvestBlock[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const field_name = str(cellAt(row, col, 'field_name'))
    const block_name = str(cellAt(row, col, 'block_name'))
    const variety = str(cellAt(row, col, 'variety'))
    const hectares = num(cellAt(row, col, 'hectares'))
    const plants_per_ha = num(cellAt(row, col, 'plants_per_ha'))
    if (!field_name || !block_name) continue
    if (hectares == null || hectares <= 0) continue

    blocks.push({
      field_name,
      block_name,
      crop: str(cellAt(row, col, 'crop')) || 'Cerezo',
      variety: variety || null,
      hectares,
      plants_per_ha: plants_per_ha ?? getCherryVarietyDefaults(variety).plantsPerHa,
    })
  }

  return blocks
}

const BELLAVISTA_COUNT_ALIASES: Record<string, string[]> = {
  field_name: ['campo'],
  block_name: ['cuartel'],
  variety: ['variedad'],
  hilera: ['hilera'],
  arbol: ['arbol', 'árbol'],
  dardo: ['dardo', 'dardos'],
  ramillas: ['ramillas'],
  dardo_coral: ['dardo coral'],
  count_state: ['estado'],
}

function parseEsNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function isBellavistaCountSheet(headerRow: unknown[]): boolean {
  const col = mapHeaders(headerRow, BELLAVISTA_COUNT_ALIASES)
  return col.field_name != null && col.block_name != null && col.dardo != null && col.ramillas != null
}

function cellAt(row: unknown[], col: Record<string, number>, key: string): unknown {
  const idx = col[key]
  if (idx === undefined) return null
  return row[idx]
}

/** Metadata desde celdas tipo "Cerezo | Lapins | 51 L | 5,2 | 1136 | 2019" */
function parsePipeMetadata(wb: XLSX.WorkBook): Map<string, { hectares: number; plants_per_ha: number }> {
  const map = new Map<string, { hectares: number; plants_per_ha: number }>()
  const re = /Cerezo\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)/i

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: null })
    for (const row of rows) {
      for (const cell of row ?? []) {
        const text = str(cell)
        if (!text.includes('|')) continue
        const m = text.match(re)
        if (!m) continue
        const variety = m[1].trim()
        const block = m[2].trim()
        const hectares = parseEsNumber(m[3])
        const plants = parseEsNumber(m[4])
        if (hectares == null || hectares <= 0) continue
        const key = `${block}::${variety}`
        if (!map.has(key)) {
          map.set(key, {
            hectares,
            plants_per_ha: plants ?? getCherryVarietyDefaults(variety).plantsPerHa,
          })
        }
      }
    }
  }
  return map
}

function enrichFromMetadata(
  row: ParsedHarvestEstimate,
  meta: Map<string, { hectares: number; plants_per_ha: number }>,
): ParsedHarvestEstimate {
  const keys = [
    `${row.block_name}::${row.variety}`,
    `${row.block_name.replace(/\s+/g, '')}::${row.variety}`,
  ]
  for (const key of keys) {
    const hit = meta.get(key)
    if (hit) {
      return {
        ...row,
        hectares: row.hectares > 0 ? row.hectares : hit.hectares,
        plants_per_ha: row.plants_per_ha ?? hit.plants_per_ha,
      }
    }
  }
  return row
}

function enrichFromVarietyDefaults(row: ParsedHarvestEstimate): ParsedHarvestEstimate {
  const defaults = getCherryVarietyDefaults(row.variety)
  return {
    ...row,
    plants_per_ha: row.plants_per_ha ?? defaults.plantsPerHa,
    primordia_per_dardo: row.primordia_per_dardo ?? defaults.primordiaPerDardo,
    primordia_per_branch: row.primordia_per_branch ?? defaults.primordiaPerBranch,
    fruit_set_pct: row.fruit_set_pct ?? defaults.fruitSetPct,
    fruit_weight_kg: row.fruit_weight_kg ?? defaults.fruitWeightKg,
  }
}

function parseBellavistaSampleRow(
  row: unknown[],
  col: Record<string, number>,
  season_label: string,
  carry: { field_name: string; block_name: string; variety: string },
): ParsedHarvestEstimate | null {
  const field_name = str(cellAt(row, col, 'field_name')) || carry.field_name
  const block_name = str(cellAt(row, col, 'block_name')) || carry.block_name
  const variety = str(cellAt(row, col, 'variety')) || carry.variety
  const dardo = num(cellAt(row, col, 'dardo'))
  const ramillas = num(cellAt(row, col, 'ramillas'))
  const dardoCoral = num(cellAt(row, col, 'dardo_coral'))
  const hilera = num(cellAt(row, col, 'hilera'))
  const arbol = num(cellAt(row, col, 'arbol'))

  if (!field_name || !block_name || !variety) return null
  if (dardo == null && ramillas == null && dardoCoral == null) return null

  return {
    field_name,
    block_name,
    crop: 'Cerezo',
    variety,
    season_label,
    hectares: 0,
    plants_per_ha: null,
    hilera,
    arbol,
    dardos_per_plant: dardo,
    dardos_per_branch: ramillas,
    dardo_coral: dardoCoral,
    primordia_per_dardo: null,
    primordia_per_branch: null,
    fruit_set_pct: null,
    fruits_set: null,
    fruit_weight_kg: null,
    kg_per_plant: null,
    kg_per_ha: null,
    estimated_kg: 0,
    count_state: parseCountState(cellAt(row, col, 'count_state')) ?? 'Pre-poda',
  }
}

export function isBellavistaDashboardWorkbook(wb: XLSX.WorkBook): boolean {
  return wb.SheetNames.some((name) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null })
    return rows.length > 1 && isBellavistaCountSheet(rows[0] as unknown[])
  })
}

export function parseBellavistaDashboardWorkbook(buffer: ArrayBuffer): ParsedHarvestImport {
  const wb = XLSX.read(buffer, { type: 'array' })
  if (!isBellavistaDashboardWorkbook(wb)) {
    throw new Error('No se reconoce el formato Dashboard Agrícola Bellavista.')
  }

  const meta = parsePipeMetadata(wb)
  const season_label = seasonFromSheetName(wb.SheetNames.find((n) => /hoja|conteo|cosecha/i.test(n)) ?? wb.SheetNames[0])
  const rawRows: ParsedHarvestEstimate[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
    if (rows.length < 2 || !isBellavistaCountSheet(rows[0] as unknown[])) continue

    const col = mapHeaders(rows[0] as unknown[], BELLAVISTA_COUNT_ALIASES)
    const carry = { field_name: '', block_name: '', variety: '' }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      const field = str(cellAt(row, col, 'field_name'))
      const block = str(cellAt(row, col, 'block_name'))
      const variety = str(cellAt(row, col, 'variety'))
      if (field) carry.field_name = field
      if (block) carry.block_name = block
      if (variety) carry.variety = variety

      const parsed = parseBellavistaSampleRow(row, col, season_label, carry)
      if (parsed) rawRows.push(parsed)
    }
  }

  if (rawRows.length === 0) {
    throw new Error('No se encontraron muestras de conteo en el Dashboard Bellavista.')
  }

  let estimates = rawRows.map((row) => enrichFromVarietyDefaults(enrichFromMetadata(row, meta)))

  estimates = estimates.filter(
    (e) => e.dardos_per_plant != null || e.dardos_per_branch != null || e.dardo_coral != null,
  )

  if (estimates.length === 0) {
    throw new Error('No se encontraron muestras de conteo válidas.')
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
        hectares: e.hectares > 0 ? e.hectares : null,
        plants_per_ha: e.plants_per_ha,
      })
    }
  }

  for (const db of parseDatosReservadosBlocks(wb)) {
    const key = `${db.field_name}::${db.block_name}`
    const existing = blockMap.get(key)
    blockMap.set(key, {
      field_name: db.field_name,
      block_name: db.block_name,
      crop: db.crop || existing?.crop || 'Cerezo',
      variety: db.variety ?? existing?.variety ?? null,
      hectares: db.hectares ?? existing?.hectares ?? null,
      plants_per_ha: db.plants_per_ha ?? existing?.plants_per_ha ?? null,
    })
  }

  const sheetName = wb.SheetNames.filter((n) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: null })
    return rows.length > 1 && isBellavistaCountSheet(rows[0] as unknown[])
  }).join(' + ')

  return {
    sheetName: sheetName || 'Dashboard Bellavista',
    season_label,
    fields,
    blocks: [...blockMap.values()],
    estimates,
    source_row_count: rawRows.length,
  }
}
