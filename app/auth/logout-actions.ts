'use server'

import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit-log'
import { getViewAsContext } from '@/lib/impersonation'

/** Registra cierre de sesión antes de signOut (llamar desde el cliente). */
export async function logLogoutAction(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const viewAs = await getViewAsContext()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, parent_user_id')
    .eq('id', user.id)
    .maybeSingle()

  const label = profile?.full_name || profile?.email || user.email || user.id
  const wasSupportMode = Boolean(viewAs.viewAsUserId)

  await logAudit(
    supabase,
    {
      action_type: 'LOGOUT',
      target_type: 'session',
      target_id: user.id,
      target_label: label,
      description: wasSupportMode
        ? `${label} cerró sesión (salió del modo soporte como ${viewAs.viewAsName || viewAs.viewAsEmail || 'cliente'})`
        : `${label} cerró sesión`,
      metadata: {
        support_mode: wasSupportMode,
        view_as_user_id: viewAs.viewAsUserId ?? null,
        view_as_label: viewAs.viewAsName || viewAs.viewAsEmail || null,
      },
    },
    {
      actor_id: user.id,
      actor_email: profile?.email ?? user.email ?? null,
      actor_name: profile?.full_name ?? null,
      actor_role: profile?.role ?? null,
    },
  )
}
