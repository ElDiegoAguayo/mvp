import { currentSeasonLabel } from './format'
import type { HarvestCountState } from './cherry-harvest-formula'

export const COUNT_COL_ALIASES: Record<string, string[]> = {
  field_name: ['campo'],
  crop: ['especie'],
  variety: ['variedad'],
  block_name: ['cuartel'],
  hilera: ['hilera'],
  arbol: ['arbol', 'árbol'],
  hectares: ['superficie total cuartel', 'superficie', 'ha'],
  plants_per_ha: ['plantas/ha', 'plantas ha', 'pl/ha'],
  dardos_per_plant: ['dardos/planta', 'dardos planta', 'dardo', 'dardos'],
  dardos_per_branch: ['dardos/ramilla', 'dardos ramilla', 'ramillas'],
  dardo_coral: ['dardo coral'],
  primordia_per_dardo: ['primordios/dardo', 'primordios dardo'],
  primordia_per_branch: ['primordios/ramilla', 'primordios ramilla'],
  fruit_set_pct: ['%cuaja', '% cuaja', 'cuaja'],
  fruits_set: ['frutos cuajados', 'frutos/pl'],
  fruit_weight_kg: ['peso de fruto', 'peso fruto'],
  count_state: ['estado', 'estado conteo'],
  record_date: ['fecha'],
  season_label: ['temporada'],
}

export const ESTIMATION_COL_ALIASES: Record<string, string[]> = {
  ...COUNT_COL_ALIASES,
  kg_per_plant: ['kg/planta', 'kg planta'],
  kg_per_ha: ['kg/ha'],
  estimated_kg: ['kg totales', 'kg total'],
  harvested_kg: ['kg cosechados', 'cosechado'],
  status: ['estado cosecha', 'estado harvest'],
}

export function normHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function str(v: unknown): string {
  return String(v ?? '').trim()
}

export function mapHeaders(headerRow: unknown[], aliases: Record<string, string[]>): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    const n = normHeader(h)
    for (const [key, keys] of Object.entries(aliases)) {
      if (keys.some((a) => n === a || n.includes(a))) {
        if (map[key] === undefined) map[key] = i
      }
    }
  })
  return map
}

export function cell(row: unknown[], col: Record<string, number>, key: string): unknown {
  const idx = col[key]
  if (idx === undefined) return null
  return row[idx]
}

export function seasonFromSheetName(name: string): string {
  const m = name.match(/(\d{4}\s*[-–]\s*\d{4})/)
  if (m) return m[1].replace(/\s/g, '')
  return currentSeasonLabel()
}

export function parseCountState(v: unknown): HarvestCountState | null {
  const s = str(v)
  if (/post/i.test(s)) return 'Post-poda'
  if (/pre/i.test(s)) return 'Pre-poda'
  return null
}

export function normalizeFruitSetPct(v: number | null): number | null {
  if (v == null) return null
  return v > 1 ? v / 100 : v
}
