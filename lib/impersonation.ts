import { cookies } from 'next/headers'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const VIEW_AS_COOKIE = 'upcrop_view_as'

export type ViewAsContext = {
  viewAsUserId: string | null
  viewAsName: string | null
  viewAsEmail: string | null
}

/** Read view-as cookie; only valid when caller is admin. */
export async function getViewAsContext(): Promise<ViewAsContext> {
  const empty: ViewAsContext = { viewAsUserId: null, viewAsName: null, viewAsEmail: null }

  const cookieStore = await cookies()
  const targetId = cookieStore.get(VIEW_AS_COOKIE)?.value?.trim()
  if (!targetId) return empty

  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return empty

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') return empty

  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .eq('id', targetId)
    .single()

  if (!target || target.role === 'admin' || target.is_active === false) return empty

  return {
    viewAsUserId: target.id,
    viewAsName: target.full_name,
    viewAsEmail: target.email,
  }
}
