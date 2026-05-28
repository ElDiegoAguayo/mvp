export const HARVEST_CROPS = [
  'Cerezo',
  'Uva',
  'Manzano',
  'Arándano',
  'Kiwi',
  'Duraznero',
  'Nectarino',
  'Ciruela',
  'Damasco',
  'Palto',
  'Pera',
  'Naranjo',
  'Limonero',
  'Mandarina',
  'Frambuesa',
  'Frutilla',
  'Granado',
] as const

export type HarvestCrop = (typeof HARVEST_CROPS)[number]

export interface CropVariety {
  name: string
  /** Rendimiento referencial exportación Chile (kg/ha) */
  yieldKgPerHa: number
}

/** Variedades comerciales por cultivo con rendimiento base kg/ha */
export const CROP_VARIETIES: Record<HarvestCrop, CropVariety[]> = {
  Cerezo: [
    { name: 'Lapins', yieldKgPerHa: 17_000 },
    { name: 'Santina', yieldKgPerHa: 15_000 },
    { name: 'Regina', yieldKgPerHa: 16_000 },
    { name: 'Kordia', yieldKgPerHa: 14_000 },
    { name: 'Sweet Heart', yieldKgPerHa: 16_500 },
    { name: 'Bing', yieldKgPerHa: 12_000 },
    { name: 'Royal Dawn', yieldKgPerHa: 13_500 },
    { name: 'Stella', yieldKgPerHa: 11_500 },
  ],
  Uva: [
    { name: 'Red Globe', yieldKgPerHa: 22_000 },
    { name: 'Thompson Seedless', yieldKgPerHa: 20_000 },
    { name: 'Crimson Seedless', yieldKgPerHa: 18_000 },
    { name: 'Sugraone', yieldKgPerHa: 19_500 },
    { name: 'Autumn Royal', yieldKgPerHa: 16_500 },
    { name: 'Flame Seedless', yieldKgPerHa: 17_500 },
    { name: 'Allison', yieldKgPerHa: 15_000 },
    { name: 'Sweet Celebration', yieldKgPerHa: 16_000 },
  ],
  Manzano: [
    { name: 'Fuji', yieldKgPerHa: 60_000 },
    { name: 'Gala', yieldKgPerHa: 52_000 },
    { name: 'Granny Smith', yieldKgPerHa: 58_000 },
    { name: 'Pink Lady', yieldKgPerHa: 48_000 },
    { name: 'Royal Gala', yieldKgPerHa: 50_000 },
    { name: 'Red Delicious', yieldKgPerHa: 45_000 },
    { name: 'Braeburn', yieldKgPerHa: 47_000 },
  ],
  Arándano: [
    { name: 'Legacy', yieldKgPerHa: 10_000 },
    { name: 'Duke', yieldKgPerHa: 8_500 },
    { name: 'Bluecrop', yieldKgPerHa: 9_500 },
    { name: 'Emerald', yieldKgPerHa: 11_000 },
    { name: 'Jewel', yieldKgPerHa: 9_000 },
    { name: 'Ventura', yieldKgPerHa: 10_500 },
    { name: 'Star', yieldKgPerHa: 8_000 },
    { name: 'Royal Dawn', yieldKgPerHa: 9_000 },
    { name: 'Blue Ribbon', yieldKgPerHa: 10_500 },
    { name: 'Camelia', yieldKgPerHa: 9_500 },
    { name: 'Draper', yieldKgPerHa: 10_000 },
    { name: 'Suzie Blue', yieldKgPerHa: 9_000 },
    { name: 'Eureka', yieldKgPerHa: 8_500 },
    { name: 'Chandler', yieldKgPerHa: 9_500 },
    { name: 'O\'Neal', yieldKgPerHa: 8_000 },
    { name: 'Brigitta', yieldKgPerHa: 9_000 },
  ],
  Kiwi: [
    { name: 'Hayward', yieldKgPerHa: 30_000 },
    { name: 'Jintao', yieldKgPerHa: 24_000 },
    { name: 'Dori', yieldKgPerHa: 21_000 },
    { name: 'Soreli', yieldKgPerHa: 22_000 },
    { name: 'Green Light', yieldKgPerHa: 26_000 },
  ],
  Duraznero: [
    { name: 'Spring Crest', yieldKgPerHa: 28_000 },
    { name: 'O\'Henry', yieldKgPerHa: 26_000 },
    { name: 'Spring Lady', yieldKgPerHa: 24_000 },
    { name: 'Rich Lady', yieldKgPerHa: 25_000 },
    { name: 'Elegant Lady', yieldKgPerHa: 27_000 },
    { name: 'Flameprince', yieldKgPerHa: 23_000 },
  ],
  Nectarino: [
    { name: 'Fantasia', yieldKgPerHa: 26_000 },
    { name: 'Magique', yieldKgPerHa: 24_000 },
    { name: 'Arctic Rose', yieldKgPerHa: 22_000 },
    { name: 'Honey Royale', yieldKgPerHa: 25_000 },
    { name: 'Morsiani 90', yieldKgPerHa: 23_000 },
  ],
  Ciruela: [
    { name: 'Angeleno', yieldKgPerHa: 20_000 },
    { name: 'Larry Ann', yieldKgPerHa: 18_000 },
    { name: 'Black Splendor', yieldKgPerHa: 19_000 },
    { name: 'Fortune', yieldKgPerHa: 17_000 },
    { name: 'Red Globe', yieldKgPerHa: 16_000 },
  ],
  Damasco: [
    { name: 'Modesto', yieldKgPerHa: 15_000 },
    { name: 'Perfection', yieldKgPerHa: 14_000 },
    { name: 'Patterson', yieldKgPerHa: 13_000 },
    { name: 'Rival', yieldKgPerHa: 12_000 },
  ],
  Palto: [
    { name: 'Hass', yieldKgPerHa: 12_000 },
    { name: 'Fuerte', yieldKgPerHa: 10_000 },
    { name: 'Bacon', yieldKgPerHa: 9_000 },
    { name: 'Reed', yieldKgPerHa: 11_000 },
    { name: 'Lamb Hass', yieldKgPerHa: 12_500 },
  ],
  Pera: [
    { name: 'Packham\'s', yieldKgPerHa: 45_000 },
    { name: 'Williams', yieldKgPerHa: 42_000 },
    { name: 'Forelle', yieldKgPerHa: 38_000 },
    { name: 'Abate Fetel', yieldKgPerHa: 40_000 },
    { name: 'Conference', yieldKgPerHa: 41_000 },
  ],
  Naranjo: [
    { name: 'Navel', yieldKgPerHa: 35_000 },
    { name: 'Valencia', yieldKgPerHa: 32_000 },
    { name: 'Cara Cara', yieldKgPerHa: 30_000 },
    { name: 'Lane Late', yieldKgPerHa: 33_000 },
  ],
  Limonero: [
    { name: 'Eureka', yieldKgPerHa: 28_000 },
    { name: 'Lisbon', yieldKgPerHa: 26_000 },
    { name: 'Genova', yieldKgPerHa: 27_000 },
  ],
  Mandarina: [
    { name: 'Murcott', yieldKgPerHa: 25_000 },
    { name: 'Clementina', yieldKgPerHa: 24_000 },
    { name: 'Tango', yieldKgPerHa: 26_000 },
    { name: 'W. Murcott', yieldKgPerHa: 25_500 },
  ],
  Frambuesa: [
    { name: 'Heritage', yieldKgPerHa: 8_000 },
    { name: 'Meeker', yieldKgPerHa: 7_500 },
    { name: 'Tulameen', yieldKgPerHa: 8_500 },
    { name: 'Adelita', yieldKgPerHa: 7_000 },
  ],
  Frutilla: [
    { name: 'Albion', yieldKgPerHa: 35_000 },
    { name: 'Monterey', yieldKgPerHa: 32_000 },
    { name: 'Camarosa', yieldKgPerHa: 30_000 },
    { name: 'San Andreas', yieldKgPerHa: 33_000 },
    { name: 'Portola', yieldKgPerHa: 31_000 },
  ],
  Granado: [
    { name: 'Wonderful', yieldKgPerHa: 25_000 },
    { name: 'Acco', yieldKgPerHa: 22_000 },
    { name: 'Smith', yieldKgPerHa: 20_000 },
    { name: 'Parfianka', yieldKgPerHa: 21_000 },
  ],
}

/** Descripción de la fórmula por cultivo (referencial campo Chile) */
export const HARVEST_FORMULA_HINT: Record<HarvestCrop, string> = {
  Cerezo: 'Frutos cuajados por conteo de dardos/primordios × % cuaja → kg/planta → kg/ha → kg totales',
  Uva: 'kg = hectáreas × rendimiento variedad (kg/ha uva de mesa)',
  Manzano: 'kg = hectáreas × rendimiento variedad (kg/ha manzano)',
  Arándano: 'kg = hectáreas × rendimiento variedad (kg/ha arándano)',
  Kiwi: 'kg = hectáreas × rendimiento variedad (kg/ha kiwifruit)',
  Duraznero: 'kg = hectáreas × rendimiento variedad (kg/ha duraznero)',
  Nectarino: 'kg = hectáreas × rendimiento variedad (kg/ha nectarino)',
  Ciruela: 'kg = hectáreas × rendimiento variedad (kg/ha ciruela)',
  Damasco: 'kg = hectáreas × rendimiento variedad (kg/ha damasco)',
  Palto: 'kg = hectáreas × rendimiento variedad (kg/ha palto)',
  Pera: 'kg = hectáreas × rendimiento variedad (kg/ha pera)',
  Naranjo: 'kg = hectáreas × rendimiento variedad (kg/ha naranjo)',
  Limonero: 'kg = hectáreas × rendimiento variedad (kg/ha limonero)',
  Mandarina: 'kg = hectáreas × rendimiento variedad (kg/ha mandarina)',
  Frambuesa: 'kg = hectáreas × rendimiento variedad (kg/ha frambuesa)',
  Frutilla: 'kg = hectáreas × rendimiento variedad (kg/ha frutilla)',
  Granado: 'kg = hectáreas × rendimiento variedad (kg/ha granado)',
}

export function getVarietiesForCrop(crop: string): CropVariety[] {
  return CROP_VARIETIES[crop as HarvestCrop] ?? []
}

export function getVarietyYield(crop: string, variety: string): number | null {
  const match = getVarietiesForCrop(crop).find((v) => v.name === variety)
  return match?.yieldKgPerHa ?? null
}

export function calculateHarvestEstimateKg(
  crop: string,
  variety: string,
  hectares: number,
): number | null {
  if (!Number.isFinite(hectares) || hectares <= 0) return null
  const yieldPerHa = getVarietyYield(crop, variety)
  if (yieldPerHa == null) return null
  return Math.round(hectares * yieldPerHa)
}

export function formatHarvestFormula(
  crop: string,
  variety: string,
  hectares: number,
): string | null {
  const yieldPerHa = getVarietyYield(crop, variety)
  const total = calculateHarvestEstimateKg(crop, variety, hectares)
  if (yieldPerHa == null || total == null) return null
  const haLabel = hectares.toLocaleString('es-CL', { maximumFractionDigits: 2 })
  const yieldLabel = yieldPerHa.toLocaleString('es-CL')
  const totalLabel = total.toLocaleString('es-CL')
  return `${haLabel} ha × ${yieldLabel} kg/ha = ${totalLabel} kg`
}
