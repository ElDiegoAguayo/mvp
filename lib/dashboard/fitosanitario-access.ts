import { createClient } from '@/lib/supabase/server'
import { userCanAccessModuleBySlug } from '@/lib/dashboard/module-access'

const MODULE_SLUG = 'inventario-fitosanitario'

export async function userCanAccessFitosanitario(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return userCanAccessModuleBySlug(supabase, user.id, MODULE_SLUG)
}
