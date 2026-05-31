'use client'

import { cn } from '@/lib/utils'

const SPARKLES = [
  { top: '10%', left: '12%', delay: '0s', duration: '2.4s', size: 4 },
  { top: '22%', left: '78%', delay: '0.6s', duration: '3s', size: 5 },
  { top: '45%', left: '6%', delay: '1.2s', duration: '2.8s', size: 3 },
  { top: '58%', left: '92%', delay: '0.3s', duration: '3.2s', size: 4 },
  { top: '72%', left: '18%', delay: '1.8s', duration: '2.6s', size: 3 },
  { top: '85%', left: '70%', delay: '1s', duration: '2.9s', size: 5 },
  { top: '35%', left: '48%', delay: '2.1s', duration: '3.4s', size: 3 },
  { top: '68%', left: '55%', delay: '0.9s', duration: '2.7s', size: 4 },
  { top: '15%', left: '55%', delay: '1.5s', duration: '3.1s', size: 3 },
  { top: '88%', left: '38%', delay: '2.4s', duration: '2.5s', size: 4 },
] as const

interface PlanPremiumEffectsProps {
  className?: string
}

/** Brillos, destellos y shimmer dorado para el plan Business */
export function PlanPremiumEffects({ className }: PlanPremiumEffectsProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-2xl', className)}
      aria-hidden
    >
      {/* Halo pulsante esquinas */}
      <div className="plan-premium-glow absolute -left-6 -top-6 h-28 w-28 rounded-full bg-amber-300/25 blur-2xl" />
      <div
        className="plan-premium-glow absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-amber-500/20 blur-2xl"
      />

      {/* Barrido de luz dorada (solo hacia abajo) */}
      <div className="plan-premium-shimmer absolute -inset-[60%]" />

      {/* Filo dorado animado en borde superior */}
      <div className="plan-premium-edge absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />

      {/* Partículas brillantes */}
      {SPARKLES.map((sparkle, index) => (
        <span
          key={index}
          className="plan-premium-sparkle absolute"
          style={{
            top: sparkle.top,
            left: sparkle.left,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: sparkle.delay,
            animationDuration: sparkle.duration,
          }}
        />
      ))}

      {/* Estrellas de 4 puntas */}
      {[
        { top: '18%', right: '14%', delay: '0.4s' },
        { top: '62%', left: '10%', delay: '1.6s' },
        { top: '78%', right: '22%', delay: '2.2s' },
      ].map((star, index) => (
        <span
          key={`star-${index}`}
          className="plan-premium-star absolute text-amber-200/90"
          style={{ top: star.top, right: 'right' in star ? star.right : undefined, left: 'left' in star ? star.left : undefined, animationDelay: star.delay }}
        >
          ✦
        </span>
      ))}
    </div>
  )
}
