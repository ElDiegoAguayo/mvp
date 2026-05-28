/**
 * Fórmula de estimación de cosecha para cerezo (conteo de dardos y primordios).
 *
 * Frutos cuajados = (Dardos/planta × Primordios/dardo + Dardos/ramilla × Primordios/ramilla) × % cuaja
 * Kg/planta      = Frutos cuajados × Peso de fruto
 * Kg/ha          = Kg/planta × Plantas/ha
 * Kg totales     = Kg/ha × Superficie (ha)
 */

export const HARVEST_COUNT_STATES = ['Pre-poda', 'Post-poda'] as const
export type HarvestCountState = (typeof HARVEST_COUNT_STATES)[number]

export interface CherryCountParams {
  plantsPerHa: number
  dardosPerPlant: number
  dardosPerBranch: number
  primordiaPerDardo: number
  primordiaPerBranch: number
  fruitSetPct: number
  fruitWeightKg: number
  hectares: number
}

export interface CherryCountResult {
  fruitsSet: number
  kgPerPlant: number
  kgPerHa: number
  kgTotal: number
}

/** Parámetros de conteo por variedad (Datos Reservados / estimaciones 2025-2026) */
export const CHERRY_VARIETY_DEFAULTS: Record<string, Omit<CherryCountParams, 'hectares'>> = {
  Santina: {
    plantsPerHa: 888,
    dardosPerPlant: 600,
    dardosPerBranch: 90,
    primordiaPerDardo: 17.25,
    primordiaPerBranch: 20.02,
    fruitSetPct: 0.2,
    fruitWeightKg: 0.012,
  },
  Lapins: {
    plantsPerHa: 1250,
    dardosPerPlant: 470,
    dardosPerBranch: 142,
    primordiaPerDardo: 17.4,
    primordiaPerBranch: 0,
    fruitSetPct: 0.25,
    fruitWeightKg: 0.01,
  },
  Regina: {
    plantsPerHa: 1100,
    dardosPerPlant: 640,
    dardosPerBranch: 110,
    primordiaPerDardo: 18.5,
    primordiaPerBranch: 12.75,
    fruitSetPct: 0.18,
    fruitWeightKg: 0.01,
  },
  Kordia: {
    plantsPerHa: 1100,
    dardosPerPlant: 520,
    dardosPerBranch: 95,
    primordiaPerDardo: 18,
    primordiaPerBranch: 14,
    fruitSetPct: 0.17,
    fruitWeightKg: 0.01,
  },
  'Sweet Heart': {
    plantsPerHa: 1100,
    dardosPerPlant: 580,
    dardosPerBranch: 100,
    primordiaPerDardo: 17.8,
    primordiaPerBranch: 15,
    fruitSetPct: 0.18,
    fruitWeightKg: 0.011,
  },
  Bing: {
    plantsPerHa: 888,
    dardosPerPlant: 550,
    dardosPerBranch: 85,
    primordiaPerDardo: 16.5,
    primordiaPerBranch: 18,
    fruitSetPct: 0.19,
    fruitWeightKg: 0.012,
  },
  'Royal Dawn': {
    plantsPerHa: 889,
    dardosPerPlant: 480,
    dardosPerBranch: 75,
    primordiaPerDardo: 16,
    primordiaPerBranch: 0,
    fruitSetPct: 0.22,
    fruitWeightKg: 0.011,
  },
  Stella: {
    plantsPerHa: 667,
    dardosPerPlant: 500,
    dardosPerBranch: 80,
    primordiaPerDardo: 16.2,
    primordiaPerBranch: 0,
    fruitSetPct: 0.2,
    fruitWeightKg: 0.012,
  },
}

export function getCherryVarietyDefaults(variety: string): Omit<CherryCountParams, 'hectares'> {
  return CHERRY_VARIETY_DEFAULTS[variety] ?? CHERRY_VARIETY_DEFAULTS.Santina
}

export function calculateCherryHarvest(params: CherryCountParams): CherryCountResult {
  const {
    plantsPerHa,
    dardosPerPlant,
    dardosPerBranch,
    primordiaPerDardo,
    primordiaPerBranch,
    fruitSetPct,
    fruitWeightKg,
    hectares,
  } = params

  const fruitsSet =
    (dardosPerPlant * primordiaPerDardo + dardosPerBranch * primordiaPerBranch) * fruitSetPct

  const kgPerPlant = fruitsSet * fruitWeightKg
  const kgPerHa = kgPerPlant * plantsPerHa
  const kgTotal = kgPerHa * hectares

  return { fruitsSet, kgPerPlant, kgPerHa, kgTotal }
}

/** Pasos intermedios como columnas del Excel */
export function getCherryCalculationSteps(params: CherryCountParams) {
  const result = calculateCherryHarvest(params)
  const primordiaTotal =
    params.dardosPerPlant * params.primordiaPerDardo
    + params.dardosPerBranch * params.primordiaPerBranch

  return {
    primordiaTotal,
    fruitsSet: result.fruitsSet,
    fruitWeightKg: params.fruitWeightKg,
    kgPerPlant: result.kgPerPlant,
    kgPerHa: result.kgPerHa,
    kgTotal: result.kgTotal,
    plantsPerHa: params.plantsPerHa,
    hectares: params.hectares,
  }
}

export type CherryFormFields = {
  hectares: string
  plants_per_ha: string
  dardos_per_plant: string
  dardos_per_branch: string
  primordia_per_dardo: string
  primordia_per_branch: string
  fruit_set_pct: string
  fruit_weight_kg: string
}

function parseNum(value: string, fallback = 0): number {
  if (value.trim() === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Cálculo en vivo mientras el usuario rellena (valores vacíos = 0) */
export function computeCherryHarvestLive(form: CherryFormFields): CherryCountParams | null {
  const hectares = parseNum(form.hectares)
  const plantsPerHa = parseNum(form.plants_per_ha)
  const fruitSetPct = parseNum(form.fruit_set_pct)
  const fruitWeightKg = parseNum(form.fruit_weight_kg)

  if (hectares <= 0 || plantsPerHa <= 0 || fruitSetPct <= 0 || fruitWeightKg <= 0) {
    return null
  }

  return {
    hectares,
    plantsPerHa,
    dardosPerPlant: parseNum(form.dardos_per_plant),
    dardosPerBranch: parseNum(form.dardos_per_branch),
    primordiaPerDardo: parseNum(form.primordia_per_dardo),
    primordiaPerBranch: parseNum(form.primordia_per_branch),
    fruitSetPct: fruitSetPct > 1 ? fruitSetPct / 100 : fruitSetPct,
    fruitWeightKg,
  }
}

export function parseCherryFormNumbers(form: CherryFormFields): CherryCountParams | null {
  const live = computeCherryHarvestLive(form)
  if (!live) return null

  const hasCountInput =
    parseNum(form.dardos_per_plant) > 0
    || parseNum(form.dardos_per_branch) > 0

  if (!hasCountInput) return null
  if (live.fruitSetPct <= 0 || live.fruitSetPct > 1) return null

  return live
}

export function formatCherryFormulaPreview(result: CherryCountResult, params: CherryCountParams): string {
  const pct = Math.round(params.fruitSetPct * 100)
  return [
    `Frutos = (${params.dardosPerPlant}×${params.primordiaPerDardo} + ${params.dardosPerBranch}×${params.primordiaPerBranch}) × ${pct}%`,
    `→ ${result.fruitsSet.toFixed(2)} fr/planta × ${params.fruitWeightKg} kg`,
    `→ ${result.kgPerHa.toFixed(1)} kg/ha × ${params.hectares} ha = ${Math.round(result.kgTotal).toLocaleString('es-CL')} kg`,
  ].join(' · ')
}

export function cherryReferenceFields(_variety: string) {
  return {
    plants_per_ha: '',
    primordia_per_dardo: '',
    primordia_per_branch: '',
    fruit_set_pct: '',
    fruit_weight_kg: '',
  }
}

/** @deprecated use cherryReferenceFields — no precarga dardos del conteo en campo */
export function cherryDefaultsToFormFields(variety: string) {
  return {
    ...cherryReferenceFields(variety),
    dardos_per_plant: '',
    dardos_per_branch: '',
  }
}
