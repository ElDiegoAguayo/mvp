'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { completeRegistrationAction } from '@/app/auth/registro-actions'

function RegistroContent() {
  const searchParams = useSearchParams()
  const flow = searchParams.get('flow')
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [nameRequired, setNameRequired] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Tu enlace expiró o no es válido. Pide una nueva invitación al administrador.')
        setCheckingSession(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      const existingName = profile?.full_name?.trim() ?? ''
      const metadataName =
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name.trim()
          : ''

      if (existingName) {
        setFullName(existingName)
      } else if (metadataName) {
        setFullName(metadataName)
      }

      setNameRequired(
        flow !== 'welcome' || !existingName,
      )
      setCheckingSession(false)
    })()
  }, [supabase.auth, flow])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

  if (nameRequired && !fullName.trim()) {
      setError('Indica tu nombre completo.')
      return
    }
    if (nameRequired && fullName.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setIsLoading(true)
    try {
      const result = await completeRegistrationAction({
        fullName: fullName.trim(),
        password,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }

      router.replace('/dashboard')
      router.refresh()
    } catch {
      setError('No se pudo completar el registro. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const subtitle =
    flow === 'welcome'
      ? 'Define tu contraseña para acceder a Up Crop.'
      : 'Completa tu registro con tu nombre y una contraseña personal.'

  return (
    <div className="login-page-root fixed inset-0 overflow-hidden bg-white dark:bg-slate-950">
      <div className="login-v16-split h-full w-full flex min-h-0 overflow-hidden bg-white dark:bg-slate-950">
        <div className="relative flex w-full lg:w-[min(520px,46%)] shrink-0 flex-col bg-white dark:bg-slate-950 min-h-0">
          <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 sm:px-10 pb-8 min-h-0 overflow-y-auto">
            <div className="w-full max-w-[400px] space-y-5">
              <div className="space-y-1 text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Activa tu cuenta
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {nameRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Nombre completo</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                      <Input
                        id="full-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Tu nombre y apellido"
                        required
                        minLength={2}
                        disabled={isLoading}
                        autoComplete="name"
                        className="pl-10 h-[46px]"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                      minLength={8}
                      disabled={isLoading}
                      autoComplete="new-password"
                      className="pl-10 pr-11 h-[46px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                    <Input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      required
                      minLength={8}
                      disabled={isLoading}
                      autoComplete="new-password"
                      className="pl-10 h-[46px]"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-[46px] rounded-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Activar cuenta'
                  )}
                </Button>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RegistroContent />
    </Suspense>
  )
}
