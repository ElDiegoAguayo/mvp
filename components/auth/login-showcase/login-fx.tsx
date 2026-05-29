'use client'

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { LOGO_ICON } from './constants'

export function FxOrbs({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('login-fx-orbs pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`login-fx-orb login-fx-orb-${i + 1}`} />
      ))}
    </div>
  )
}

export function FxParticles({ density = 24, className }: { density?: number; className?: string }) {
  return (
    <div className={cn('login-fx-particles pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {Array.from({ length: density }).map((_, i) => (
        <span key={i} className="login-fx-particle" style={{ '--i': i } as CSSProperties} />
      ))}
    </div>
  )
}

export function FxSpinPortal({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center pointer-events-none', className)} aria-hidden>
      <div className="login-v6-ring login-v6-ring-1" />
      <div className="login-v6-ring login-v6-ring-2" />
      <div className="login-v6-ring login-v6-ring-3" />
      <div className="login-v6-logo-core login-logo-spin">
        <Image src={LOGO_ICON} alt="" width={200} height={200} className="opacity-90" />
      </div>
    </div>
  )
}

export function FxSingularity({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden', className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="login-v9-ring" style={{ animationDelay: `${i * 0.8}s` }} />
      ))}
      <div className="login-v9-core" />
    </div>
  )
}

export function FxMatrixRain({ className }: { className?: string }) {
  return (
    <div className={cn('login-v8-matrix pointer-events-none absolute inset-0 overflow-hidden opacity-40', className)} aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="login-v8-column" style={{ left: `${i * 5.5 + 2}%`, animationDelay: `${i * 0.35}s`, animationDuration: `${4 + (i % 5)}s` }}>
          {Array.from({ length: 20 }).map((__, j) => (
            <span key={j}>{(i + j) % 10}</span>
          ))}
        </div>
      ))}
    </div>
  )
}

export function FxTopoField({ className }: { className?: string }) {
  return (
    <div className={cn('login-v10-topo pointer-events-none absolute inset-0', className)} aria-hidden>
      <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none">
        {[20, 35, 50, 65, 80].map((y, i) => (
          <path
            key={y}
            className="login-v10-wave"
            style={{ animationDelay: `${i * 0.5}s` }}
            d={`M0 ${y + 10} Q250 ${y} 500 ${y + 8} T1000 ${y + 5} T1500 ${y + 12} V200 H0 Z`}
            fill="none"
            stroke="rgba(64,99,202,0.35)"
            strokeWidth="1"
          />
        ))}
      </svg>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="login-v10-node" style={{ left: `${12 + i * 11}%`, top: `${30 + (i % 3) * 18}%`, animationDelay: `${i * 0.4}s` }} />
      ))}
    </div>
  )
}

export function FxMetricBars({ className }: { className?: string }) {
  const heights = [42, 68, 55, 82, 48, 91, 63, 74, 58, 85]
  return (
    <div className={cn('flex items-end gap-1.5 h-24', className)} aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          className="login-v15-bar w-3 rounded-t-sm bg-gradient-to-t from-[#4063ca] to-[#5b7ad6]"
          style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  )
}

export function FxGravityWell({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center pointer-events-none', className)} aria-hidden>
      {[180, 240, 300].map((size, i) => (
        <div
          key={size}
          className="login-v17-orbit-path absolute rounded-full border border-[#4063ca]/20"
          style={{ width: size, height: size, animationDelay: `${i * -6}s` }}
        />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="login-v17-satellite" style={{ animationDelay: `${i * -4}s` }}>
          <Image src={LOGO_ICON} alt="" width={28} height={28} className="opacity-70" />
        </div>
      ))}
      <div className="login-v17-core" />
    </div>
  )
}

export function FxHarvestArc({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-[200px] h-[200px]', className)} aria-hidden>
      <div className="login-v23-arc absolute inset-0" />
      <div className="login-v23-arc login-v23-arc-2 absolute inset-0 m-5" />
    </div>
  )
}

export function FxProductionLine({ className }: { className?: string }) {
  return (
    <div className={cn('login-v25-line relative w-full max-w-lg h-2 rounded-full overflow-hidden', className)} aria-hidden>
      <div className="login-v25-track absolute inset-0 bg-white/5" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="login-v25-dot" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
    </div>
  )
}

export function FxColdChainSteps({ className }: { className?: string }) {
  const steps = [
    { label: 'Huerto', sub: 'Origen' },
    { label: 'Planta', sub: 'Proceso' },
    { label: 'Frío', sub: 'Cadena' },
    { label: 'Puerto', sub: 'Embarque' },
    { label: 'Mundo', sub: 'Destino' },
  ]
  return (
    <div className={cn('login-v26-chain relative pl-5', className)} aria-hidden>
      <div className="login-v26-chain-line absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-[#4063ca] to-transparent" />
      <div className="login-v26-chain-pulse absolute left-0 w-[15px] h-[15px] rounded-full bg-[#4063ca]/80 shadow-[0_0_16px_#4063ca]" />
      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={s.label} className="login-v26-chain-step flex items-center gap-3" style={{ animationDelay: `${i * 0.12}s` }}>
            <div className="relative z-10 w-[15px] h-[15px] rounded-full border-2 border-[#4063ca] bg-[#060b18] shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white leading-none">{s.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FxAiPulseRings({ className }: { className?: string }) {
  return (
    <div className={cn('login-v28-rings pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden', className)} aria-hidden>
      {[220, 320, 420].map((size, i) => (
        <div
          key={size}
          className="login-v28-ring absolute rounded-full border border-[#4063ca]/25"
          style={{ width: size, height: size, animationDelay: `${i * -2}s` }}
        />
      ))}
      <div className="login-v28-core absolute w-24 h-24 rounded-full bg-[#4063ca]/10 blur-2xl" />
    </div>
  )
}

export function FxKineticTitle({
  line1,
  line2,
  className,
  gradient = true,
}: {
  line1: string
  line2?: string
  className?: string
  gradient?: boolean
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <h1 className="login-fx-title text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1]">
        {line1}
      </h1>
      {line2 && (
        <p className={cn('text-2xl sm:text-3xl font-bold', gradient && 'login-fx-gradient-text')}>{line2}</p>
      )}
    </div>
  )
}

export function FxFloatingForm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('login-fx-float relative z-20', className)}>
      <div className="login-fx-form-glow absolute -inset-4 rounded-3xl opacity-60 pointer-events-none" />
      {children}
    </div>
  )
}

type MouseFxVariant = 'glow' | 'aurora' | 'grid' | 'prism' | 'vortex' | 'nebula'

export function FxMouseLayer({
  children,
  className,
  variant = 'glow',
  ripples = false,
  trail = false,
  orbit = false,
}: {
  children: ReactNode
  className?: string
  variant?: MouseFxVariant
  ripples?: boolean
  trail?: boolean
  orbit?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastRipple = useRef(0)
  const lastTrail = useRef(0)
  const [rippleList, setRippleList] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [trailList, setTrailList] = useState<Array<{ id: number; x: number; y: number }>>([])

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    el.style.setProperty('--mx', `${x}%`)
    el.style.setProperty('--my', `${y}%`)
    el.style.setProperty('--mx-px', `${px}px`)
    el.style.setProperty('--my-px', `${py}px`)
    el.style.setProperty('--mx-num', String(x))
    el.style.setProperty('--my-num', String(y))

    const now = Date.now()

    if (ripples && now - lastRipple.current >= 280) {
      lastRipple.current = now
      const id = now
      setRippleList((prev) => [...prev.slice(-5), { id, x: px, y: py }])
      window.setTimeout(() => {
        setRippleList((prev) => prev.filter((r) => r.id !== id))
      }, 1200)
    }

    if (trail && now - lastTrail.current >= 45) {
      lastTrail.current = now
      const id = now
      setTrailList((prev) => [...prev.slice(-16), { id, x: px, y: py }])
      window.setTimeout(() => {
        setTrailList((prev) => prev.filter((r) => r.id !== id))
      }, 900)
    }
  }, [ripples, trail])

  return (
    <div ref={ref} className={cn('login-fx-mouse-layer relative', className)} onMouseMove={onMove}>
      <div className={cn('login-fx-mouse-fx pointer-events-none absolute inset-0 z-0', `login-fx-mouse-${variant}`)} aria-hidden />
      {orbit && (
        <div className="login-fx-orbit-ring pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="login-fx-orbit-dot" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )}
      {trail && (
        <div className="login-fx-trail-layer pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
          {trailList.map((r) => (
            <span key={r.id} className="login-fx-trail-dot" style={{ left: r.x, top: r.y } as CSSProperties} />
          ))}
        </div>
      )}
      {ripples && (
        <div className="login-fx-ripples pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
          {rippleList.map((r) => (
            <span key={r.id} className="login-fx-ripple" style={{ left: r.x, top: r.y } as CSSProperties} />
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

export function FxMagneticForm({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height
    el.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`
  }, [])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)'
  }, [])

  return (
    <div
      ref={ref}
      className={cn('login-fx-magnetic relative z-20 transition-transform duration-300 ease-out will-change-transform', className)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  )
}

export function FxCursorConstellation({ className }: { className?: string }) {
  const points = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      x: 8 + (i * 17) % 84,
      y: 10 + ((i * 23) % 80),
      delay: i * 0.2,
    })),
  )

  return (
    <svg className={cn('login-v34-stars absolute inset-0 w-full h-full pointer-events-none', className)} aria-hidden>
      {points.current.map((p, i) => (
        <circle key={i} cx={`${p.x}%`} cy={`${p.y}%`} r="2" className="login-v34-star" style={{ animationDelay: `${p.delay}s` }} />
      ))}
    </svg>
  )
}

export function FxParallaxLayer({
  children,
  className,
  depth = 10,
}: {
  children: ReactNode
  className?: string
  depth?: number
}) {
  return (
    <div
      className={cn('login-fx-parallax will-change-transform', className)}
      style={{ '--parallax-depth': depth } as CSSProperties}
    >
      {children}
    </div>
  )
}

export function FxSpinLogoBg({
  className,
  opacity = 0.12,
}: {
  className?: string
  opacity?: number
}) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 z-0 flex items-center justify-center', className)} aria-hidden>
      <Image
        src={LOGO_ICON}
        alt=""
        width={480}
        height={480}
        className="login-fx-spin-logo h-auto max-w-[85vw] w-[min(480px,55vh)]"
        style={{ opacity }}
      />
    </div>
  )
}

export function FxWaveField({ className }: { className?: string }) {
  return (
    <div className={cn('login-v38-waves pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="login-v38-wave" style={{ top: `${6 + i * 6.5}%`, animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  )
}

export function FxFormSpotlight({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    el.style.setProperty('--fx-x', `${x}%`)
    el.style.setProperty('--fx-y', `${y}%`)
  }, [])

  const onLeave = useCallback(() => {
    ref.current?.style.setProperty('--fx-x', '50%')
    ref.current?.style.setProperty('--fx-y', '50%')
  }, [])

  return (
    <div
      ref={ref}
      className={cn('login-fx-form-spotlight relative', className)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="login-fx-form-spotlight-glow pointer-events-none absolute -inset-px rounded-2xl" aria-hidden />
      {children}
    </div>
  )
}
