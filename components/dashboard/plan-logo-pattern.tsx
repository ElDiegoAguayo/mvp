'use client'

import type { CSSProperties } from 'react'
import type { PlanVisualTier } from '@/lib/subscription-plan-styles'
import { cn } from '@/lib/utils'

const LOGO_MASK = "url('/logo-upcrop-isotype.png')"

/** Tonos del propio metal de cada tarjeta — sin azul de marca */
const TIER_PATTERN: Record<
  PlanVisualTier,
  { color: string; opacity: number; size: number; rotate?: number; blend: CSSProperties['mixBlendMode'] }
> = {
  bronze: { color: '#5c3412', opacity: 0.11, size: 50, blend: 'multiply' },
  silver: { color: '#52525b', opacity: 0.1, size: 48, blend: 'multiply' },
  premium: { color: '#fde68a', opacity: 0.06, size: 52, rotate: -8, blend: 'soft-light' },
}

interface PlanLogoPatternProps {
  tier: PlanVisualTier
  className?: string
}

/** Marca de agua repetida del isotipo Up Crop, camuflada con el metal de cada tarjeta */
export function PlanLogoPattern({ tier, className }: PlanLogoPatternProps) {
  const cfg = TIER_PATTERN[tier]

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl', className)}
      aria-hidden
    >
      <div
        className="absolute -inset-[20%]"
        style={{
          mixBlendMode: cfg.blend,
          opacity: cfg.opacity,
          backgroundColor: cfg.color,
          WebkitMaskImage: LOGO_MASK,
          maskImage: LOGO_MASK,
          WebkitMaskRepeat: 'repeat',
          maskRepeat: 'repeat',
          WebkitMaskSize: `${cfg.size}px ${cfg.size}px`,
          maskSize: `${cfg.size}px ${cfg.size}px`,
          transform: cfg.rotate ? `rotate(${cfg.rotate}deg)` : undefined,
        }}
      />
    </div>
  )
}
