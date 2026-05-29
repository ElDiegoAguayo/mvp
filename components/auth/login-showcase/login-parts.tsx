'use client'

import { useEffect, useState, type FormEvent, type ReactNode, type ComponentType } from 'react'
import Image from 'next/image'
import {
  Mail, Lock, AlertCircle, Loader2, ArrowRight, ShieldAlert, ExternalLink, Sun, Moon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LOGO_ICON, type LoginVariantId } from './constants'
import { THEMES } from './themes'

export type LoginFormBlockProps = {
  variant: LoginVariantId
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  error: string | null
  lockoutMinutes: number | null
  isLoading: boolean
  onSubmit: (e: FormEvent) => void
}

export function LoginFormBlock({
  variant,
  email,
  setEmail,
  password,
  setPassword,
  error,
  lockoutMinutes,
  isLoading,
  onSubmit,
}: LoginFormBlockProps) {
  const t = THEMES[variant]
  const iconMuted = t.isLight ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={cn('login-form-block w-full max-w-[400px] space-y-5', t.formCard)}>
      <div className="space-y-1">
        <h2 className={cn('text-xl sm:text-2xl font-bold', t.title)}>Bienvenido</h2>
        <p className={cn('text-sm', t.subtitle)}>Ingresa tus credenciales para acceder</p>
      </div>

      {error && (
        <Alert variant="destructive" className={t.alert}>
          {lockoutMinutes ? (
            <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5" />
          )}
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5">
        <div className="space-y-2">
          <Label htmlFor="email" className={t.label}>Email</Label>
          <div className="relative">
            <Mail className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px]', iconMuted)} />
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={t.input}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className={t.label}>Contraseña</Label>
          <div className="relative">
            <Lock className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px]', iconMuted)} />
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={t.input}
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={isLoading || lockoutMinutes !== null}
          className={cn(
            'w-full h-[46px] font-semibold rounded-lg text-[15px] transition-all',
            lockoutMinutes !== null ? t.buttonDisabled : t.button,
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Iniciando sesión...
            </>
          ) : lockoutMinutes !== null ? (
            <>
              <ShieldAlert className="mr-2 h-5 w-5" />
              Bloqueado por {lockoutMinutes} minutos
            </>
          ) : (
            <>
              Iniciar Sesión
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>

      <p className={cn('text-xs leading-relaxed', t.footer)}>
        Acceso restringido. El registro se realiza únicamente por administración.
      </p>
    </div>
  )
}

function LoginThemeToggle({ variant }: { variant: LoginVariantId }) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-11 h-11" aria-hidden />

  const isDark = resolvedTheme === 'dark'
  const btnClass = THEMES[variant].isLight
    ? 'bg-[#4063ca] text-white hover:bg-[#3B5DE7]'
    : 'bg-white/10 border border-white/20 text-white hover:bg-white/15'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors shadow-md', btnClass)}
      aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}

export function HeaderBar({ variant, children }: { variant: LoginVariantId; children?: ReactNode }) {
  const t = THEMES[variant]

  return (
    <header className="login-header-bar grid grid-cols-[1fr_auto_1fr] items-center w-full px-4 sm:px-8 lg:px-12 py-2.5 sm:py-3 shrink-0 relative z-20">
      <div className="flex items-center gap-2">
        <Image src={LOGO_ICON} alt="UpCrop" width={32} height={32} className="object-contain shrink-0 sm:w-9 sm:h-9" priority />
        <span className={cn('text-lg sm:text-xl font-bold tracking-tight lowercase', t.logoText)}>upcrop</span>
      </div>
      <a
        href="https://www.upcrop-ia.com"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-colors',
          t.siteLink,
        )}
      >
        <span className="hidden sm:inline">Ir al sitio</span>
        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </a>
      <div className="flex justify-end items-center gap-2">
        {children}
        <LoginThemeToggle variant={variant} />
      </div>
    </header>
  )
}

export function HeroImage({ className, overlay }: { className?: string; overlay?: string }) {
  return (
    <div className={cn('relative rounded-2xl overflow-hidden max-h-full', className)}>
      {overlay && <div className={cn('absolute inset-0 z-10', overlay)} />}
      <Image
        src="/login-hero.png"
        alt="Centro de operaciones UpCrop"
        width={1024}
        height={571}
        className="w-full h-auto block relative z-0"
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
    </div>
  )
}

export function SpinningLogoBackdrop({
  size = 480,
  opacity = 0.2,
  blur = false,
  reverse = false,
  speed = 22,
}: {
  size?: number
  opacity?: number
  blur?: boolean
  reverse?: boolean
  speed?: number
}) {
  return (
    <div
      className={cn('absolute pointer-events-none login-logo-spin relative', reverse && 'login-logo-spin-reverse')}
      style={{ width: size, height: size, opacity, animationDuration: `${speed}s`, filter: blur ? 'blur(1px)' : undefined }}
      aria-hidden
    >
      <Image src={LOGO_ICON} alt="" width={size} height={size} className="object-contain w-full h-full" />
    </div>
  )
}

export function OrbitLogos() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="login-orbit-ring" style={{ animationDelay: `${i * -7}s` }}>
          <Image src={LOGO_ICON} alt="" width={40} height={40} className="login-orbit-logo opacity-60" />
        </div>
      ))}
    </div>
  )
}

export function BrandMark({
  size = 'md',
  className,
  light = true,
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  light?: boolean
}) {
  const iconSize = size === 'sm' ? 48 : size === 'lg' ? 96 : 72
  const titleClass = size === 'sm' ? 'text-2xl' : size === 'lg' ? 'text-5xl' : 'text-4xl'

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <Image src={LOGO_ICON} alt="UpCrop" width={iconSize} height={iconSize} priority />
      <div className="text-center">
        <p className={cn('font-bold lowercase tracking-tight', titleClass, light ? 'text-white' : 'text-slate-900')}>
          up<span className="text-[#4063ca]">crop</span>
        </p>
        <p className={cn('text-xs mt-1', light ? 'text-slate-400' : 'text-slate-500')}>Agri-Tech Solutions</p>
      </div>
    </div>
  )
}

export function BrandStoryPanel({
  eyebrow,
  title,
  description,
  icon: Icon,
  className,
}: {
  eyebrow: string
  title: string
  description: string
  icon?: ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div className={cn('space-y-4 max-w-md', className)}>
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-[#4063ca]/15 border border-[#4063ca]/30 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#4063ca]" />
        </div>
      )}
      <p className="text-[#4063ca] text-xs font-semibold uppercase tracking-[0.2em]">{eyebrow}</p>
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">{title}</h1>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

export function ModulePills({ modules, className }: { modules: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {modules.map((m) => (
        <span
          key={m}
          className="px-3 py-1 rounded-full text-[11px] font-medium border border-[#4063ca]/30 bg-[#4063ca]/10 text-[#a5b8ff]"
        >
          {m}
        </span>
      ))}
    </div>
  )
}

export function JourneySteps({ steps, className }: { steps: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-0 sm:items-center', className)}>
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#4063ca]/10 border border-[#4063ca]/25 text-xs font-medium text-slate-200">
            <span className="w-5 h-5 rounded-full bg-[#4063ca] text-[10px] font-bold flex items-center justify-center text-white">{i + 1}</span>
            {step}
          </span>
          {i < steps.length - 1 && (
            <span className="hidden sm:inline text-[#4063ca] mx-1">→</span>
          )}
        </div>
      ))}
    </div>
  )
}
