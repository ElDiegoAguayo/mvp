'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit-log'
import { VIEW_AS_COOKIE } from '@/lib/impersonation'

const VIEW_AS_MAX_AGE = 60 * 60 * 4 // 4 hours

export async function startImpersonationAction(targetUserId: string): Promise<{ ok: boolean; message: string }> {
  if (!targetUserId?.trim()) {
    return { ok: false, message: 'Usuario inválido.' }
  }

  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden usar modo soporte.' }
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, parent_user_id')
    .eq('id', targetUserId)
    .single()

  if (!target) return { ok: false, message: 'Usuario no encontrado.' }
  if (target.role === 'admin') return { ok: false, message: 'No puedes impersonar a otro administrador.' }
  if (target.is_active === false) return { ok: false, message: 'La cuenta del cliente está bloqueada.' }

  const cookieStore = await cookies()
  cookieStore.set(VIEW_AS_COOKIE, target.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VIEW_AS_MAX_AGE,
  })

  const targetLabel = target.full_name || target.email || target.id
  const roleLabel = target.parent_user_id ? 'subusuario' : 'cliente'

  await logAudit(
    supabase,
    {
      action_type: 'IMPERSONATION_START',
      description: `Modo soporte: viendo la plataforma como ${targetLabel} (${roleLabel})`,
      target_type: 'user',
      target_id: target.id,
      target_label: targetLabel,
      metadata: {
        target_email: target.email,
        target_role: target.role,
        is_subuser: !!target.parent_user_id,
      },
    },
    {
      actor_id: caller.id,
      actor_email: callerProfile?.email ?? caller.email ?? null,
      actor_name: callerProfile?.full_name ?? null,
      actor_kind: 'admin',
    },
  )

  redirect('/dashboard')
}

export async function stopImpersonationAction(): Promise<void> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const targetId = cookieStore.get(VIEW_AS_COOKIE)?.value?.trim() ?? null

  let targetLabel = targetId ?? 'cliente'
  if (targetId) {
    const { data: target } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', targetId)
      .single()
    targetLabel = target?.full_name || target?.email || targetId
  }

  cookieStore.delete(VIEW_AS_COOKIE)

  if (caller) {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role === 'admin' && targetId) {
      await logAudit(
        supabase,
        {
          action_type: 'IMPERSONATION_END',
          description: `Salió del modo soporte (dejó de ver como ${targetLabel})`,
          target_type: 'user',
          target_id: targetId,
          target_label: targetLabel,
        },
        {
          actor_id: caller.id,
          actor_email: callerProfile?.email ?? caller.email ?? null,
          actor_name: callerProfile?.full_name ?? null,
          actor_kind: 'admin',
        },
      )
    }
  }

  redirect('/admin?tab=usuarios')
}
