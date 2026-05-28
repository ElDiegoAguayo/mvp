'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Lock, AlertCircle, Loader2, ArrowRight, ShieldAlert, ExternalLink } from 'lucide-react'
import { checkLoginLockout, checkIpBlocked, getLoginClientIpAction, recordLoginAttempt, auditSecurityEvent } from '@/app/auth/login-actions'
import Image from 'next/image'

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

      // STEP 5: Verify the account is active
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', data.user.id)
          .maybeSingle()

        if (profileError) {
          console.error('[v0] Profile fetch error:', profileError)
          await supabase.auth.signOut()
          setError('No se pudo verificar el estado de tu cuenta. Intenta de nuevo.')
          setIsLoading(false)
          return // ABORT
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
    <div className="min-h-screen bg-background bg-grid flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A6CF7]/5 via-transparent to-transparent" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center overflow-hidden">
              <Image 
                src="/logo-upcrop.png" 
                alt="UpCrop Logo" 
                width={32} 
                height={32}
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold text-[#4A6CF7]">UpCrop</span>
          </div>
          <a 
            href="https://www.upcrop-ia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 text-[#4A6CF7] hover:bg-[#4A6CF7] hover:text-white transition-all duration-200"
          >
            <span className="text-sm font-medium">Ir al sitio</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl font-bold leading-tight text-balance text-foreground">
            Tecnologia para el
            <span className="text-[#4A6CF7]"> futuro agricola</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-md text-pretty">
            Gestiona tus operaciones agricolas con inteligencia. Trazabilidad, comercio exterior, inventario y mas en una sola plataforma.
          </p>
          
          <div className="grid grid-cols-2 gap-4 pt-8">
            {['Trazabilidad', 'Comex', 'Inventario', 'Clima', 'Mercado'].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-[#4A6CF7]" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-muted-foreground">
          2024 UpCrop. Agri-Tech Solutions.
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center overflow-hidden">
              <Image 
                src="/logo-upcrop.png" 
                alt="UpCrop Logo" 
                width={28} 
                height={28}
                className="object-contain"
              />
            </div>
            <span className="text-xl font-bold text-[#4A6CF7]">UpCrop</span>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-foreground">Bienvenido</h2>
            <p className="text-muted-foreground">
              Ingresa tus credenciales para acceder
            </p>
          </div>

          {error && (
            <Alert
              variant="destructive"
              className={`${
                lockoutMinutes
                  ? 'bg-red-500/15 border-red-400/50'
                  : 'bg-destructive/10 border-destructive/20'
              }`}
            >
              {lockoutMinutes ? (
                <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5" />
              )}
              <AlertDescription className={lockoutMinutes ? 'text-red-700 font-semibold' : ''}>
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 bg-card border-border focus:border-[#4A6CF7] focus:ring-[#4A6CF7]/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-12 bg-card border-border focus:border-[#4A6CF7] focus:ring-[#4A6CF7]/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || lockoutMinutes !== null}
              className={`w-full h-12 font-semibold transition-all ${
                lockoutMinutes !== null
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white shadow-lg hover:shadow-[#4A6CF7]/25'
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

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Acceso restringido. El registro se realiza únicamente por administración.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#4A6CF7]" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
