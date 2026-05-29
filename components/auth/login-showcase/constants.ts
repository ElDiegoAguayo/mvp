export const UPCROP = {
  primary: '#4063ca',
  primaryBright: '#4A6CF7',
  primaryHover: '#3B5DE7',
  dark: '#0e0d0b',
  navy: '#060b18',
  black: '#030712',
} as const

export const LOGIN_VARIANT_COUNT = 15
export const STORAGE_KEY = 'upcrop-login-variant'

export type LoginVariantId = number

export const LOGIN_VARIANTS: Array<{ id: number; label: string; tag: string }> = [
  { id: 1, label: '1', tag: 'Editorial' },
  { id: 2, label: '2', tag: 'War Room' },
  { id: 3, label: '3', tag: 'Glass' },
  { id: 4, label: '4', tag: 'Aurora' },
  { id: 5, label: '5', tag: 'Horizon' },
  { id: 6, label: '6', tag: 'Cold Chain' },
  { id: 7, label: '7', tag: 'AI Pulse' },
  { id: 8, label: '8', tag: 'Masterpiece' },
  { id: 9, label: '9', tag: 'Spotlight' },
  { id: 10, label: '10', tag: 'Ripple' },
  { id: 11, label: '11', tag: 'Aurora Hunt' },
  { id: 12, label: '12', tag: 'Comet' },
  { id: 13, label: '13', tag: 'Chain · Master' },
  { id: 14, label: '14', tag: 'Grid Fusion' },
  { id: 15, label: '15', tag: 'Twin Panel' },
]

export function isValidVariantId(v: number): v is LoginVariantId {
  return Number.isInteger(v) && v >= 1 && v <= LOGIN_VARIANT_COUNT
}

/** Icono UpCrop sin fondo — PNG con canal alpha */
export const LOGO_ICON = '/logo-upcrop.png'
