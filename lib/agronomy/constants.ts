export const HARVEST_STATUSES = [
  { value: 'planificado', label: 'Planificado' },
  { value: 'en_curso', label: 'En cosecha' },
  { value: 'finalizado', label: 'Finalizado' },
] as const

export type HarvestStatus = (typeof HARVEST_STATUSES)[number]['value']

export const DEFAULT_PHENOLOGY_STAGES: Record<string, Array<{
  stage_name: string
  stage_code: string
  sort_order: number
  typical_days: number | null
  description: string
}>> = {
  Cerezo: [
    { stage_code: 'C1', stage_name: 'Reposo', sort_order: 1, typical_days: null, description: 'Yema en reposo invernal.' },
    { stage_code: 'C2', stage_name: 'Hinchamiento de yemas', sort_order: 2, typical_days: 30, description: 'Inicio de actividad fisiológica.' },
    { stage_code: 'C3', stage_name: 'Botón blanco', sort_order: 3, typical_days: 14, description: 'Botones florales visibles.' },
    { stage_code: 'C4', stage_name: 'Floración', sort_order: 4, typical_days: 7, description: 'Apertura floral.' },
    { stage_code: 'C5', stage_name: 'Cuajado', sort_order: 5, typical_days: 21, description: 'Fijación inicial del fruto.' },
    { stage_code: 'C6', stage_name: 'Crecimiento I', sort_order: 6, typical_days: 28, description: 'Expansión celular del fruto.' },
    { stage_code: 'C7', stage_name: 'Cambio de color', sort_order: 7, typical_days: 21, description: 'Inicio de maduración.' },
    { stage_code: 'C8', stage_name: 'Cosecha', sort_order: 8, typical_days: 14, description: 'Ventana de cosecha comercial.' },
  ],
  Uva: [
    { stage_code: 'V1', stage_name: 'Brotación', sort_order: 1, typical_days: null, description: 'Salida de brotes.' },
    { stage_code: 'V2', stage_name: 'Floración', sort_order: 2, typical_days: 35, description: 'Floración y polinización.' },
    { stage_code: 'V3', stage_name: 'Cuajado', sort_order: 3, typical_days: 14, description: 'Formación del racimo.' },
    { stage_code: 'V4', stage_name: 'Envero', sort_order: 4, typical_days: 45, description: 'Cambio de color y acumulación de azúcar.' },
    { stage_code: 'V5', stage_name: 'Maduración', sort_order: 5, typical_days: 21, description: 'Pre-cosecha.' },
  ],
  Manzano: [
    { stage_code: 'M1', stage_name: 'Reposo', sort_order: 1, typical_days: null, description: 'Invierno.' },
    { stage_code: 'M2', stage_name: 'Brotación', sort_order: 2, typical_days: 45, description: 'Salida de hojas.' },
    { stage_code: 'M3', stage_name: 'Floración', sort_order: 3, typical_days: 21, description: 'Flor abierta.' },
    { stage_code: 'M4', stage_name: 'Cuajado', sort_order: 4, typical_days: 28, description: 'Fruto joven.' },
    { stage_code: 'M5', stage_name: 'Crecimiento', sort_order: 5, typical_days: 60, description: 'Llenado del fruto.' },
    { stage_code: 'M6', stage_name: 'Cosecha', sort_order: 6, typical_days: 30, description: 'Madurez comercial.' },
  ],
  Arándano: [
    { stage_code: 'A1', stage_name: 'Yema Dormida', sort_order: 1, typical_days: null, description: 'Reposo invernal.' },
    { stage_code: 'A2', stage_name: 'Yema Hinchada', sort_order: 2, typical_days: 21, description: 'Hinchamiento de yemas.' },
    { stage_code: 'A3', stage_name: 'Ramillete Expuesto', sort_order: 3, typical_days: 7, description: 'Expansión del ramillete.' },
    { stage_code: 'A4', stage_name: 'Brácteas abiertas', sort_order: 4, typical_days: 7, description: 'Brácteas visibles.' },
    { stage_code: 'A5', stage_name: 'Botón Rosado', sort_order: 5, typical_days: 7, description: 'Botón floral rosado.' },
    { stage_code: 'A6', stage_name: 'Botón blanco', sort_order: 6, typical_days: 5, description: 'Botón floral blanco.' },
    { stage_code: 'A7', stage_name: 'Inicio Floración', sort_order: 7, typical_days: 5, description: 'Primeras flores abiertas.' },
    { stage_code: 'A8', stage_name: '30% Floración', sort_order: 8, typical_days: 7, description: 'Floración temprana.' },
    { stage_code: 'A9', stage_name: '50-80% Floración', sort_order: 9, typical_days: 7, description: 'Floración plena.' },
    { stage_code: 'A10', stage_name: '50% Cuaja', sort_order: 10, typical_days: 14, description: 'Cuajado parcial.' },
    { stage_code: 'A11', stage_name: '100% Cuaja', sort_order: 11, typical_days: 14, description: 'Cuajado completo.' },
    { stage_code: 'A12', stage_name: 'Fruto en Crecimiento', sort_order: 12, typical_days: 21, description: 'Expansión del fruto.' },
    { stage_code: 'A13', stage_name: 'Inicio de Pinta', sort_order: 13, typical_days: 14, description: 'Inicio cambio de color.' },
  ],
}

export const COMMON_CROPS = [
  'Arándano',
  'Cerezo',
  'Ciruela',
  'Damasco',
  'Duraznero',
  'Frambuesa',
  'Frutilla',
  'Granado',
  'Kiwi',
  'Limonero',
  'Manzano',
  'Mandarina',
  'Naranjo',
  'Nectarino',
  'Palto',
  'Pera',
  'Uva',
]

/** Colores de cabecera por cultivo (fenología / cuarteles) */
export const CROP_HEADER_STYLES: Record<string, { header: string; title: string; subtitle: string }> = {
  Arándano: {
    header: 'bg-blue-800/95 border-b-2 border-blue-400',
    title: 'text-blue-50',
    subtitle: 'text-blue-100/90',
  },
  Uva: {
    header: 'bg-purple-900/95 border-b-2 border-purple-400',
    title: 'text-purple-50',
    subtitle: 'text-purple-100/90',
  },
  Kiwi: {
    header: 'bg-emerald-800/95 border-b-2 border-lime-400',
    title: 'text-emerald-50',
    subtitle: 'text-emerald-100/90',
  },
  Cerezo: {
    header: 'bg-rose-900/95 border-b-2 border-rose-400',
    title: 'text-rose-50',
    subtitle: 'text-rose-100/90',
  },
  Manzano: {
    header: 'bg-red-900/95 border-b-2 border-green-500',
    title: 'text-red-50',
    subtitle: 'text-red-100/90',
  },
  Duraznero: {
    header: 'bg-orange-800/95 border-b-2 border-orange-300',
    title: 'text-orange-50',
    subtitle: 'text-orange-100/90',
  },
  Nectarino: {
    header: 'bg-amber-800/95 border-b-2 border-amber-300',
    title: 'text-amber-50',
    subtitle: 'text-amber-100/90',
  },
  Ciruela: {
    header: 'bg-violet-900/95 border-b-2 border-violet-400',
    title: 'text-violet-50',
    subtitle: 'text-violet-100/90',
  },
  Damasco: {
    header: 'bg-yellow-700/95 border-b-2 border-yellow-300',
    title: 'text-yellow-50',
    subtitle: 'text-yellow-100/90',
  },
  Palto: {
    header: 'bg-green-900/95 border-b-2 border-green-400',
    title: 'text-green-50',
    subtitle: 'text-green-100/90',
  },
  Pera: {
    header: 'bg-lime-800/95 border-b-2 border-lime-300',
    title: 'text-lime-50',
    subtitle: 'text-lime-100/90',
  },
  Naranjo: {
    header: 'bg-orange-700/95 border-b-2 border-orange-400',
    title: 'text-orange-50',
    subtitle: 'text-orange-100/90',
  },
  Limonero: {
    header: 'bg-yellow-600/95 border-b-2 border-yellow-400',
    title: 'text-yellow-50',
    subtitle: 'text-yellow-100/90',
  },
  Mandarina: {
    header: 'bg-amber-700/95 border-b-2 border-amber-400',
    title: 'text-amber-50',
    subtitle: 'text-amber-100/90',
  },
  Frambuesa: {
    header: 'bg-fuchsia-900/95 border-b-2 border-fuchsia-400',
    title: 'text-fuchsia-50',
    subtitle: 'text-fuchsia-100/90',
  },
  Frutilla: {
    header: 'bg-red-800/95 border-b-2 border-red-400',
    title: 'text-red-50',
    subtitle: 'text-red-100/90',
  },
  Granado: {
    header: 'bg-rose-800/95 border-b-2 border-rose-300',
    title: 'text-rose-50',
    subtitle: 'text-rose-100/90',
  },
}

const DEFAULT_CROP_HEADER = {
  header: 'bg-lime-800/95 border-b-2 border-lime-400',
  title: 'text-lime-50',
  subtitle: 'text-lime-100/90',
}

export function getCropHeaderStyle(crop: string) {
  return CROP_HEADER_STYLES[crop] ?? DEFAULT_CROP_HEADER
}
