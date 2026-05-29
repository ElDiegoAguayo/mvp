'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { checkLoginLockout, checkIpBlocked, getLoginClientIpAction, recordLoginAttempt, auditSecurityEvent } from '@/app/auth/login-actions'
import { getMaintenanceModePublicAction } from '@/app/admin/maintenance-actions'
import { LoginShowcase, useLoginVariant } from '@/components/auth/login-showcase'

function LoginContent() {
  const { variant, changeVariant } = useLoginVariant()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null)
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

        // Full navigation so session cookies sync reliably in production (avoids RSC redirect issues)
        window.location.assign('/dashboard')
        return
      }
    } catch (error) {
      console.error('[v0] Login handler error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error inesperado. Intenta de nuevo'
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <LoginShowcase
      variant={variant}
      onVariantChange={changeVariant}
      formProps={{
        email,
        setEmail,
        password,
        setPassword,
        error,
        lockoutMinutes,
        isLoading,
        onSubmit: handleLogin,
      }}
    />
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#4A6CF7]" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
