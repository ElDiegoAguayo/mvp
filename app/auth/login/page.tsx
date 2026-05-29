'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Lock, AlertCircle, Loader2, ArrowRight, ShieldAlert, ExternalLink, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { checkLoginLockout, checkIpBlocked, getLoginClientIpAction, recordLoginAttempt, auditSecurityEvent } from '@/app/auth/login-actions'
import { getMaintenanceModePublicAction } from '@/app/admin/maintenance-actions'
import Image from 'next/image'

function LoginThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="w-11 h-11" aria-hidden />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-11 h-11 rounded-full bg-[#4A6CF7] text-white shadow-md hover:bg-[#3B5DE7] flex items-center justify-center transition-colors"
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  )
}

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams.get('blocked') === '1') {
      setError(
        'Acceso denegado. Tu cuenta se encuentra suspendida por pagos pendientes. Por favor, comunícate con administración.',
      )
    }
    if (searchParams.get('maintenance') === '1') {
      void getMaintenanceModePublicAction().then((state) => {
        if (state.enabled) setError(state.message)
      })
    }
  }, [searchParams])

  const getErrorMessage = (error: string): string => {
    // Generic message for any auth failure: protects against user enumeration
    // and treats "email not confirmed" the same way for the fictitious accounts flow.
    if (
      error.includes('Invalid login credentials') ||
      error.includes('Email not confirmed') ||
      error.includes('User not found') ||
      error.includes('Invalid user') ||
      error.toLowerCase().includes('invalid')
    ) {
      return 'Credenciales inválidas'
    }
    if (error.includes('Too many requests')) {
      return 'Demasiados intentos. Intenta más tarde'
    }
    return 'Credenciales inválidas'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // STEP 1: Clean email input immediately
      const cleanEmail = email.toLowerCase().trim()
      
      if (!cleanEmail || !password) {
        setError('Por favor completa todos los campos')
        setIsLoading(false)
        return
      }

      // STEP 2: Resolve client IP on the server (unified source)
      const clientIp = await getLoginClientIpAction()
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'

      // STEP 3: Check if IP is manually blocked by admin
      const ipBlock = await checkIpBlocked(clientIp)
      if (ipBlock.blocked) {
        const msg = ipBlock.reason
          ? `Acceso denegado desde esta IP. Motivo: ${ipBlock.reason}`
          : 'Acceso denegado desde esta IP. Contacta al administrador.'
        setError(msg)
        try {
          await recordLoginAttempt(cleanEmail, clientIp, userAgent, false)
          await auditSecurityEvent(
            cleanEmail,
            'Anónimo',
            'LOGIN_BLOCKED_IP',
            `Intento de login desde IP bloqueada${ipBlock.reason ? `: ${ipBlock.reason}` : ''}`,
            clientIp,
            userAgent,
          )
        } catch { /* non-blocking */ }
        setIsLoading(false)
        return
      }

      // STEP 4: CHECK LOCKOUT — before any auth operation
      const lockoutResult = await checkLoginLockout(cleanEmail, clientIp)
      
      if (lockoutResult.isBlocked) {
        const errorMsg = lockoutResult.error || `Acceso bloqueado. Intenta en ${lockoutResult.remainingMinutes} minuto${lockoutResult.remainingMinutes !== 1 ? 's' : ''}.`
        setError(errorMsg)
        setLockoutMinutes(lockoutResult.remainingMinutes)
        
        console.log('[v0] LOGIN_BLOCKED - Email:', cleanEmail, 'IP:', clientIp, 'Minutes remaining:', lockoutResult.remainingMinutes)
        
        // Audit the blockage attempt
        try {
          await auditSecurityEvent(
            cleanEmail,
            'Anónimo',
            'LOGIN_BLOCKED_BY_RATE_LIMIT',
            `Intento de login rechazado. IP/Email bloqueados por 5+ intentos fallidos. Minutos restantes: ${lockoutResult.remainingMinutes}`,
            clientIp,
            userAgent,
          )
        } catch (auditError) {
          console.error('[v0] Audit error (non-blocking):', auditError)
        }
        
        setIsLoading(false)
        return // ABORT IMMEDIATELY
      }

      console.log('[v0] STEP 2: Not locked out, attempting login for email:', cleanEmail)

      // STEP 4: Only attempt login if NOT blocked
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (signInError) {
        console.log('[v0] LOGIN_FAILED - Email:', cleanEmail, 'Error:', signInError.message)
        
        // Record the failed attempt
        try {
          await recordLoginAttempt(cleanEmail, clientIp, userAgent, false)
        } catch (recordError) {
          console.error('[v0] Record attempt error (non-blocking):', recordError)
        }
        
        // Audit failed login
        try {
          await auditSecurityEvent(
            cleanEmail,
            'Anónimo',
            'LOGIN_FAILED',
            `Intento de inicio de sesión fallido: ${signInError.message}`,
            clientIp,
            userAgent,
          )
        } catch (auditError) {
          console.error('[v0] Audit error (non-blocking):', auditError)
        }

        setError(getErrorMessage(signInError.message))
        setIsLoading(false)
        return // ABORT on login failure
      }

      // STEP 5: Verify the account is active and maintenance mode
      if (data.user) {
        const maintenance = await getMaintenanceModePublicAction()

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_active, role')
          .eq('id', data.user.id)
          .maybeSingle()

        if (profileError) {
          console.error('[v0] Profile fetch error:', profileError)
          await supabase.auth.signOut()
          setError('No se pudo verificar el estado de tu cuenta. Intenta de nuevo.')
          setIsLoading(false)
          return // ABORT
        }

        if (maintenance.enabled && profile?.role === 'user') {
          console.log('[v0] Maintenance block - Email:', data.user.email)
          await supabase.auth.signOut()
          setError(maintenance.message)
          try {
            await recordLoginAttempt(cleanEmail, clientIp, userAgent, false)
            await auditSecurityEvent(
              cleanEmail,
              'Anónimo',
              'LOGIN_BLOCKED_MAINTENANCE',
              'Intento de inicio de sesión bloqueado por modo mantenimiento',
              clientIp,
              userAgent,
            )
          } catch { /* non-blocking */ }
          setIsLoading(false)
          return
        }

        if (profile && profile.is_active === false) {
          console.log('[v0] Account inactive - Email:', data.user.email)
          await supabase.auth.signOut()
          setError(
            'Acceso denegado. Tu cuenta se encuentra suspendida por pagos pendientes. Por favor, comunícate con administración.',
          )
          setIsLoading(false)
          return // ABORT
        }

        // STEP 6: Login successful - record success and proceed
        console.log('[v0] LOGIN_SUCCESS - Email:', data.user.email)
        
        try {
          await recordLoginAttempt(cleanEmail, clientIp, userAgent, true)
        } catch (recordError) {
          console.error('[v0] Record attempt error (non-blocking):', recordError)
        }

        try {
          await auditSecurityEvent(
            data.user.email || cleanEmail,
            data.user.email?.split('@')[0] || 'Usuario',
            'LOGIN_SUCCESS',
            'Inicio de sesión exitoso',
            clientIp,
            userAgent,
          )
        } catch (auditError) {
          console.error('[v0] Audit error (non-blocking):', auditError)
        }

        // Redirect to dashboard using router.push
        setIsLoading(false)
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('[v0] Login handler error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error inesperado. Intenta de nuevo'
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 bg-grid flex flex-col">
      {/* Header */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center w-full px-8 sm:px-12 lg:px-16 xl:px-20 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo-upcrop.png"
            alt="UpCrop Logo"
            width={36}
            height={36}
            className="object-contain shrink-0"
            priority
          />
          <span className="text-xl font-bold text-[#4A6CF7] tracking-tight">UpCrop</span>
        </div>

        <a
          href="https://www.upcrop-ia.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#4A6CF7]/20 bg-[#4A6CF7]/5 text-sm font-medium text-[#4A6CF7] hover:bg-[#4A6CF7]/10 transition-colors"
        >
          <span>Ir al sitio</span>
          <ExternalLink className="w-4 h-4" />
        </a>

        <div className="flex justify-end">
          <LoginThemeToggle />
        </div>
      </header>

      {/* Contenido — dos columnas como el mockup */}
      <main className="flex-1 flex flex-col lg:flex-row w-full px-8 sm:px-12 lg:px-16 xl:px-20 pb-10 lg:pb-12 gap-10 lg:gap-16 xl:gap-20 lg:items-center">
        {/* Izquierda */}
        <div className="lg:w-1/2 flex flex-col gap-8 lg:gap-10 lg:self-stretch lg:justify-between">
          <div className="space-y-6 lg:space-y-8">
            <h1 className="text-[2rem] sm:text-[2.35rem] lg:text-[2.5rem] xl:text-[2.75rem] font-bold leading-tight text-slate-900 tracking-tight">
              Welcome to Up Crop
            </h1>
            <div className="rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-slate-100">
              <Image
                src="/login-hero.png"
                alt="Centro de operaciones UpCrop — analytics agrícolas"
                width={1024}
                height={571}
                className="w-full h-auto block"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>

          <p className="text-sm text-slate-400 hidden lg:block">
            2024 UpCrop. Agri-Tech Solutions.
          </p>
        </div>

        {/* Derecha — formulario */}
        <div className="lg:w-1/2 flex items-center justify-center">
          <div className="w-full max-w-[400px] space-y-7">
            <div className="space-y-1.5">
              <h2 className="text-[1.75rem] font-bold text-slate-900">Bienvenido</h2>
              <p className="text-[15px] text-slate-500">
                Ingresa tus credenciales para acceder
              </p>
            </div>

            {error && (
              <Alert
                variant="destructive"
                className={
                  lockoutMinutes
                    ? 'bg-red-50 border-red-200'
                    : 'bg-red-50 border-red-200'
                }
              >
                {lockoutMinutes ? (
                  <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 text-red-600" />
                )}
                <AlertDescription className="text-red-700 font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-800 font-medium text-sm">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-[46px] bg-[#EEF2FF] border-slate-200/80 text-slate-900 placeholder:text-slate-400 rounded-lg focus:border-[#4A6CF7] focus:ring-[#4A6CF7]/20 focus-visible:ring-[#4A6CF7]/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-800 font-medium text-sm">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 h-[46px] bg-[#EEF2FF] border-slate-200/80 text-slate-900 placeholder:text-slate-400 rounded-lg focus:border-[#4A6CF7] focus:ring-[#4A6CF7]/20 focus-visible:ring-[#4A6CF7]/20"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || lockoutMinutes !== null}
                className={`w-full h-[46px] font-semibold transition-all rounded-lg text-[15px] ${
                  lockoutMinutes !== null
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white shadow-sm'
                }`}
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

            <p className="text-xs text-slate-400 leading-relaxed">
              Acceso restringido. El registro se realiza únicamente por administración.
            </p>
          </div>
        </div>
      </main>

      {/* Footer móvil */}
      <footer className="lg:hidden px-8 sm:px-12 pb-8 pt-2 shrink-0">
        <p className="text-sm text-slate-400">2024 UpCrop. Agri-Tech Solutions.</p>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#4A6CF7]" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
