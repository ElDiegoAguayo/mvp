'use client'

import { cn } from '@/lib/utils'

const SPARKLES = [
  { top: '14%', left: '20%', delay: '0s', duration: '3.6s', size: 3 },
  { top: '38%', left: '82%', delay: '1.4s', duration: '4s', size: 3 },
  { top: '68%', left: '14%', delay: '2.2s', duration: '3.8s', size: 2 },
  { top: '52%', left: '58%', delay: '0.8s', duration: '4.2s', size: 2 },
] as const

interface PlanSilverEffectsProps {
  className?: string
}

/** Brillos cromados suaves para Enterprise — elegante, menos intenso que Business */
export function PlanSilverEffects({ className }: PlanSilverEffectsProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-2xl', className)}
      aria-hidden
    >
      <div className="plan-silver-glow absolute -left-4 -top-4 h-24 w-24 rounded-full bg-white/30 blur-2xl" />

      <div className="plan-silver-shimmer absolute -inset-[60%]" />

      <div className="plan-silver-edge absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />

      {SPARKLES.map((sparkle, index) => (
        <span
          key={index}
          className="plan-silver-sparkle absolute"
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
    </div>
  )
}
