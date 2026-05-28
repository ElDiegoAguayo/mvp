import type { EstadoAlerta } from '@/types/produccion'

/** Capacidad en pallets se expresa en bloques de 5 (p. ej. 73 → 70). */
export const PALLETS_STEP = 5

export const UMBRAL_CRITICO_PALLETS = 15
export const UMBRAL_BAJO_PALLETS = 50
export const UMBRAL_OK_PALLETS = 50

export function redondearPalletsAbajo(pallets: number): number {
  if (pallets <= 0) return 0
  return Math.floor(pallets / PALLETS_STEP) * PALLETS_STEP
}

export function redondearUnidadesArriba(unidades: number, step = 5): number {
  if (unidades <= 0) return 0
  return Math.ceil(unidades / step) * step
}

export function clasificarAlertaPallets(pallets: number): EstadoAlerta {
  const p = redondearPalletsAbajo(pallets)
  if (p < UMBRAL_CRITICO_PALLETS) return 'critico'
  if (p < UMBRAL_BAJO_PALLETS) return 'bajo'
  return 'ok'
}
