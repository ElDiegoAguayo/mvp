import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getViewAsContext } from '@/lib/impersonation'
import { isCostosGastosModule } from '@/lib/dashboard/costos-module'

export async function userCanAccessCostosGastos(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const viewAs = await getViewAsContext()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const checkUserId = viewAs.viewAsUserId ?? user.id

  if (!viewAs.viewAsUserId && profile?.role === 'admin') return true

  const { data: accessRows } = await supabase
    .from('user_module_access')
    .select('enabled, modules:module_id (slug, name, is_active)')
    .eq('user_id', checkUserId)
    .eq('enabled', true)

  type AccessRow = {
    enabled: boolean
    modules: { slug: string; name: string; is_active: boolean } | null
  }

  return ((accessRows ?? []) as unknown as AccessRow[]).some((row) => {
    const mod = row.modules
    if (!mod?.is_active) return false
    return isCostosGastosModule(mod.slug, mod.name)
  })
}
