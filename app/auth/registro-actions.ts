'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'

export type CompleteRegistrationState = {
  ok: boolean
  message: string
}

export async function completeRegistrationAction(input: {
  fullName: string
  password: string
}): Promise<CompleteRegistrationState> {
  const fullName = input.fullName.trim()
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
      message: 'Tu enlace expiró o la sesión no es válida. Pide una nueva invitación.',
    }
  }

  let resolvedName = fullName
  if (!resolvedName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    resolvedName = profile?.full_name?.trim() ?? ''
  }

  if (!resolvedName) {
    return { ok: false, message: 'Indica tu nombre completo.' }
  }
  if (resolvedName.length < 2) {
    return { ok: false, message: 'El nombre debe tener al menos 2 caracteres.' }
  }

  const { error: authError } = await supabase.auth.updateUser({
    password,
    data: { full_name: resolvedName },
  })
  if (authError) {
    return { ok: false, message: authError.message }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: resolvedName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) {
    return {
      ok: false,
      message: `Contraseña guardada, pero no se pudo actualizar el perfil: ${profileError.message}`,
    }
  }

  return { ok: true, message: 'Cuenta activada correctamente.' }
}
