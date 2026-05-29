import type { LoginVariantId } from './constants'

export type FusionMouse = {
  variant: 'glow' | 'aurora' | 'grid' | 'nebula' | 'prism'
  ripples?: boolean
  trail?: boolean
}

export type FusionPanel =
  | 'horizon-export'
  | 'cold-chain'
  | 'master-brand'
  | 'export-chain'
  | 'master-export'
  | 'chain-horizon'
  | 'master-chain'
  | 'compact-export'
  | 'none'

export type FusionConfig = {
  tag: string
  backgrounds: Array<'horizon' | 'dots' | 'aurora' | 'noise' | 'spin'>
  spinOpacity?: number
  mouse?: FusionMouse
  panel: FusionPanel
  layout: 'split' | 'center' | 'bottom-split'
}

export const FUSION_VARIANTS: Record<number, FusionConfig> = {
  13: {
    tag: 'Chain · Master',
    backgrounds: ['dots', 'aurora', 'noise', 'spin'],
    spinOpacity: 0.12,
    mouse: { variant: 'glow' },
    panel: 'master-chain',
    layout: 'split',
  },
  14: {
    tag: 'Grid Fusion',
    backgrounds: ['aurora', 'noise', 'spin'],
    spinOpacity: 0.12,
    mouse: { variant: 'grid' },
    panel: 'master-chain',
    layout: 'split',
  },
  15: {
    tag: 'Twin Panel',
    backgrounds: ['horizon', 'aurora', 'spin'],
    spinOpacity: 0.1,
    panel: 'export-chain',
    layout: 'split',
  },
}

export const FUSION_ID_MIN = 13
export const FUSION_ID_MAX = 15

export function isFusionVariant(v: LoginVariantId): boolean {
  return v >= FUSION_ID_MIN && v <= FUSION_ID_MAX && v in FUSION_VARIANTS
}

export function getFusionConfig(v: LoginVariantId): FusionConfig | undefined {
  return FUSION_VARIANTS[v]
}
