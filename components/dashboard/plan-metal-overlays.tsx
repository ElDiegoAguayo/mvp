'use client'

import type { PlanVisualTier } from '@/lib/subscription-plan-styles'
import { cn } from '@/lib/utils'

interface PlanMetalOverlaysProps {
  tier: PlanVisualTier
  className?: string
}

/** Capas de brillo / textura metálica sobre las tarjetas de plan */
export function PlanMetalOverlays({ tier, className }: PlanMetalOverlaysProps) {
  if (tier === 'bronze') {
    return (
      <div className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-2xl', className)} aria-hidden>
        {/* Textura cepillada */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(102deg, transparent 0px, transparent 3px, rgba(101,52,14,0.35) 3px, rgba(101,52,14,0.35) 4px)',
          }}
        />
        {/* Brillo superior */}
        <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/40 via-white/10 to-transparent" />
        {/* Banda especular diagonal */}
        <div
          className="absolute -inset-[20%] opacity-[0.55]"
          style={{
            background:
              'linear-gradient(118deg, transparent 36%, rgba(255,248,235,0.85) 44%, rgba(232,184,138,0.55) 48%, rgba(184,115,51,0.35) 51%, transparent 58%)',
          }}
        />
        {/* Borde interior luminoso */}
        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55),inset_0_-2px_0_0_rgba(101,52,14,0.22)]" />
      </div>
    )
  }

  if (tier === 'silver') {
    return (
      <div className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-2xl', className)} aria-hidden>
        {/* Micro-textura cepillada */}
        <div
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(96deg, transparent 0px, transparent 1px, rgba(82,82,91,0.35) 1px, rgba(82,82,91,0.35) 2px)',
          }}
        />
        {/* Viñeta suave en bordes */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(82,82,91,0.12)_100%)]" />
        {/* Brillo superior intenso */}
        <div className="absolute inset-x-0 top-0 h-[55%] bg-gradient-to-b from-white/85 via-white/25 to-transparent" />
        {/* Reflejo principal diagonal */}
        <div
          className="absolute -inset-[18%] opacity-[0.72]"
          style={{
            background:
              'linear-gradient(112deg, transparent 30%, rgba(255,255,255,0.98) 40%, rgba(228,228,231,0.75) 46%, rgba(161,161,170,0.4) 50%, transparent 58%)',
          }}
        />
        {/* Reflejo secundario (cromo) */}
        <div
          className="absolute -inset-[10%] opacity-[0.35]"
          style={{
            background:
              'linear-gradient(68deg, transparent 58%, rgba(255,255,255,0.7) 66%, rgba(212,212,216,0.45) 70%, transparent 78%)',
          }}
        />
        {/* Punto de luz esquina superior izquierda */}
        <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/50 blur-2xl" />
        {/* Filo cromado superior */}
        <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />
        {/* Borde interior */}
        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,1),inset_0_-3px_0_0_rgba(113,113,122,0.18),inset_1px_0_0_rgba(255,255,255,0.35)]" />
      </div>
    )
  }

  // premium — oro sobre obsidiana
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-2xl', className)} aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(110deg, transparent 0px, transparent 4px, rgba(251,191,36,0.3) 4px, rgba(251,191,36,0.3) 5px)',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-amber-200/15 via-amber-400/5 to-transparent" />
      <div
        className="absolute -inset-[20%] opacity-[0.45]"
        style={{
          background:
            'linear-gradient(125deg, transparent 36%, rgba(252,211,77,0.55) 44%, rgba(245,158,11,0.35) 50%, transparent 58%)',
        }}
      />
      <div className="absolute -right-6 top-1/4 h-20 w-20 rounded-full bg-amber-300/15 blur-xl" />
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(251,191,36,0.45),inset_0_-1px_0_0_rgba(0,0,0,0.5),inset_0_0_30px_rgba(251,191,36,0.06)]" />
    </div>
  )
}
