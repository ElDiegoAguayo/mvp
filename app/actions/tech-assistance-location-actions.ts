'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { TechAssistanceLocationRow } from '@/lib/tech-assistance/location-validation'
import { MAX_CLIENT_LOCATIONS } from '@/lib/tech-assistance/location-validation'

const REVALIDATE = '/dashboard/asistencia-tecnica'

type ActionResult = { ok: true; id?: string } | { ok: false; message: string }

async function requireAdminAuth() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, isAdmin: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { supabase, user, isAdmin: profile?.role === 'admin' }
}

export async function upsertTechLocationAction(input: {
  id?: string
  clientUserId: string
  name: string
  search_query?: string | null
  lat: number
  lng: number
  radius_meters?: number
}): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await requireAdminAuth()
  if (!user) return { ok: false, message: 'No autenticado.' }
  if (!isAdmin) return { ok: false, message: 'Solo administradores pueden gestionar ubicaciones.' }

  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Indica el nombre del lugar.' }
  if (Number.isNaN(input.lat) || Number.isNaN(input.lng)) {
    return { ok: false, message: 'Coordenadas inválidas. Busca la dirección primero.' }
  }

  const radius = input.radius_meters ?? 500
  if (radius < 50 || radius > 50000) {
    return { ok: false, message: 'El radio debe estar entre 50 m y 50 km.' }
  }

  const row = {
    user_id: input.clientUserId,
    name,
    search_query: input.search_query?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    radius_meters: radius,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await supabase
      .from('tech_assistance_locations')
      .update(row)
      .eq('id', input.id)
      .eq('user_id', input.clientUserId)
    if (error) return { ok: false, message: error.message }
    revalidatePath(REVALIDATE)
    revalidatePath('/dashboard/perfil')
    return { ok: true, id: input.id }
  }

  const { count, error: countError } = await supabase
    .from('tech_assistance_locations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.clientUserId)
    .eq('is_active', true)

  if (countError) return { ok: false, message: countError.message }
  if ((count ?? 0) >= MAX_CLIENT_LOCATIONS) {
    return {
      ok: false,
      message: 'Este cliente ya tiene una ubicación. Edítala o elimínala antes de agregar otra.',
    }
  }

  const { data, error } = await supabase
    .from('tech_assistance_locations')
    .insert(row)
    .select('id')
    .single()

  if (error) return { ok: false, message: error.message }
  revalidatePath(REVALIDATE)
  revalidatePath('/dashboard/perfil')
  return { ok: true, id: data.id }
}

export async function deactivateTechLocationAction(
  locationId: string,
  clientUserId: string,
): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await requireAdminAuth()
  if (!user) return { ok: false, message: 'No autenticado.' }
  if (!isAdmin) return { ok: false, message: 'No autorizado.' }

  const { error } = await supabase
    .from('tech_assistance_locations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', locationId)
    .eq('user_id', clientUserId)

  if (error) return { ok: false, message: error.message }
  revalidatePath(REVALIDATE)
  revalidatePath('/dashboard/perfil')
  return { ok: true }
}

export type TechLocationOption = Pick<
  TechAssistanceLocationRow,
  'id' | 'name' | 'lat' | 'lng' | 'radius_meters' | 'search_query'
>

export async function listClientLocationsAction(
  clientUserId: string,
): Promise<{ ok: true; locations: TechLocationOption[] } | { ok: false; message: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, parent_user_id, is_tech_inspector')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'
  const ownerId = profile?.parent_user_id ?? user.id

  if (!isAdmin && clientUserId !== ownerId && clientUserId !== user.id) {
    return { ok: false, message: 'No autorizado.' }
  }

  const { data, error } = await supabase
    .from('tech_assistance_locations')
    .select('id, name, lat, lng, radius_meters, search_query')
    .eq('user_id', clientUserId)
    .eq('is_active', true)
    .order('name')

  if (error) return { ok: false, message: error.message }
  return { ok: true, locations: (data ?? []) as TechLocationOption[] }
}
