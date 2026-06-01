'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { buildAuthCallbackUrl } from '@/lib/auth/site-url'

export type PasswordRecoveryState = {
  ok: boolean
  message: string
}

export async function requestPasswordResetAction(input: {
  email: string
}): Promise<PasswordRecoveryState> {
  const email = input.email.trim().toLowerCase()

  if (!email) {
    return { ok: false, message: 'Indica tu correo electrónico.' }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return { ok: false, message: 'Configuración del servidor incompleta.' }
  }

  const redirectTo = buildAuthCallbackUrl('/auth/recuperar-contrasena')

  const anonClient = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await anonClient.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  return {
    ok: true,
    message: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.',
  }
}

export async function completePasswordResetAction(input: {
  password: string
}): Promise<PasswordRecoveryState> {
  const password = input.password

  if (password.length < 8) {
    return { ok: false, message: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      message: 'Tu enlace expiró o no es válido. Solicita uno nuevo desde recuperar contraseña.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true, message: 'Contraseña actualizada correctamente.' }
}
