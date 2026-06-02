import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getViewAsContext } from '@/lib/impersonation'
import { inspectorCanAccessClient } from '@/lib/tech-assistance/inspector-clients'

export async function resolvePrincipalOwnerId(
  client: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await client
    .from('profiles')
    .select('parent_user_id, role')
    .eq('id', userId)
    .maybeSingle()
  if (data?.role === 'user' && data.parent_user_id) return String(data.parent_user_id)
  return userId
}

export type HarvestOwnerResolution =
  | { ok: true; ownerId: string }
  | { ok: false; error: string }

/** Solo admin (panel clientes): importar Excel masivo a la cuenta del cliente. */
export async function assertAdminHarvestImportAccess(
  clientUserId: string,
): Promise<HarvestOwnerResolution> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const viewAs = await getViewAsContext()
  if (viewAs.viewAsUserId) {
    return { ok: false, error: 'Sal del modo soporte para importar Excel como administrador.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return { ok: false, error: 'Solo administradores pueden importar Excel de estimación de cosecha.' }
  }

  if (!clientUserId) {
    return { ok: false, error: 'Cliente no especificado.' }
  }

  return { ok: true, ownerId: clientUserId }
}

/** Comprueba que quien escribe sea admin o inspector (incl. modo soporte → inspector). */
export async function assertHarvestWriteAccess(
  service: SupabaseClient,
  clientUserId?: string | null,
): Promise<HarvestOwnerResolution> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const viewAs = await getViewAsContext()
  const actingUserId = viewAs.viewAsUserId ?? user.id

  const { data: sessionProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (sessionProfile?.role === 'admin' && !viewAs.viewAsUserId) {
    if (clientUserId) return { ok: true, ownerId: clientUserId }
    const ownerId = await resolvePrincipalOwnerId(service, user.id)
    return { ok: true, ownerId }
  }

  const { data: actingProfile } = await service
    .from('profiles')
    .select('is_tech_inspector')
    .eq('id', actingUserId)
    .maybeSingle()

  if (!actingProfile?.is_tech_inspector) {
    return { ok: false, error: 'Solo los inspectores pueden registrar o modificar conteos de cosecha.' }
  }

  if (!clientUserId) {
    return { ok: false, error: 'Selecciona un cliente para registrar conteos.' }
  }

  const allowed = await inspectorCanAccessClient(supabase, actingUserId, clientUserId)
  if (!allowed) {
    return { ok: false, error: 'Cliente no asignado a tu cuenta de inspector.' }
  }

  return { ok: true, ownerId: clientUserId }
}

/** Dueño de datos de cosecha: cliente principal, view-as admin o cliente elegido por inspector. */
export async function resolveHarvestOwnerId(
  service: SupabaseClient,
  clientUserId?: string | null,
): Promise<HarvestOwnerResolution> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const viewAs = await getViewAsContext()
  if (viewAs.viewAsUserId) {
    const ownerId = await resolvePrincipalOwnerId(service, viewAs.viewAsUserId)
    return { ok: true, ownerId }
  }

  if (clientUserId) {
    const { data: profile } = await service
      .from('profiles')
      .select('is_tech_inspector')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.is_tech_inspector) {
      return { ok: false, error: 'No autorizado para operar en nombre del cliente.' }
    }

    const allowed = await inspectorCanAccessClient(supabase, user.id, clientUserId)
    if (!allowed) {
      return { ok: false, error: 'Cliente no asignado a tu cuenta de inspector.' }
    }

    return { ok: true, ownerId: clientUserId }
  }

  const ownerId = await resolvePrincipalOwnerId(service, user.id)
  return { ok: true, ownerId }
}
