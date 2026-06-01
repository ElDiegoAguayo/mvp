import type { SupabaseClient } from '@supabase/supabase-js'
import {
  geofenceErrorMessage,
  isWithinGeofence,
  type GeofenceLocation,
} from '@/lib/tech-assistance/geofence'

export type TechAssistanceLocationRow = {
  id: string
  user_id: string
  name: string
  search_query: string | null
  lat: number
  lng: number
  radius_meters: number
  is_active: boolean
}

/** Each principal client may have at most one active work location. */
export const MAX_CLIENT_LOCATIONS = 1

/** When the client has a configured location, use it as the default for new services. */
export function defaultClientLocationId(
  locations: ReadonlyArray<{ id: string }>,
): string {
  return locations[0]?.id ?? ''
}

export function toGeofenceLocation(row: {
  id: string
  name: string
  lat: number | string
  lng: number | string
  radius_meters: number | string
}): GeofenceLocation {
  return {
    id: row.id,
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    radius_meters: Number(row.radius_meters),
  }
}

export async function fetchTechLocationById(
  supabase: SupabaseClient,
  locationId: string,
): Promise<TechAssistanceLocationRow | null> {
  const { data } = await supabase
    .from('tech_assistance_locations')
    .select('id, user_id, name, search_query, lat, lng, radius_meters, is_active')
    .eq('id', locationId)
    .eq('is_active', true)
    .maybeSingle()
  return data as TechAssistanceLocationRow | null
}

export async function resolveLocationForEntry(
  supabase: SupabaseClient,
  params: {
    ownerId: string
    locationId?: string | null
    serviceId?: string
  },
): Promise<TechAssistanceLocationRow | null> {
  if (params.locationId) {
    const loc = await fetchTechLocationById(supabase, params.locationId)
    if (loc && loc.user_id === params.ownerId) return loc
  }

  if (!params.serviceId) return null

  const { data: service } = await supabase
    .from('tech_assistance_services')
    .select('location_id')
    .eq('id', params.serviceId)
    .eq('user_id', params.ownerId)
    .maybeSingle()

  if (!service?.location_id) return null
  return fetchTechLocationById(supabase, service.location_id as string)
}

export async function assertWithinGeofence(
  supabase: SupabaseClient,
  params: {
    ownerId: string
    locationId?: string | null
    serviceId?: string
    lat: number
    lng: number
  },
): Promise<
  | { ok: true; location: TechAssistanceLocationRow | null }
  | { ok: false; message: string }
> {
  const location = await resolveLocationForEntry(supabase, params)
  if (!location) {
    return { ok: true, location: null }
  }

  const fence = toGeofenceLocation(location)
  if (isWithinGeofence(params.lat, params.lng, fence.lat, fence.lng, fence.radius_meters)) {
    return { ok: true, location }
  }

  return {
    ok: false,
    message: geofenceErrorMessage(fence, params.lat, params.lng, 'es'),
  }
}

/** Inspector must have a geofenced location on the service. */
export async function requireGeofenceLocation(
  supabase: SupabaseClient,
  params: { ownerId: string; serviceId: string },
): Promise<
  | { ok: true; location: TechAssistanceLocationRow }
  | { ok: false; message: string }
> {
  const location = await resolveLocationForEntry(supabase, {
    ownerId: params.ownerId,
    serviceId: params.serviceId,
  })
  if (!location) {
    return {
      ok: false,
      message: 'Esta labor no tiene una ubicación con geocerca. Configúrala en el admin.',
    }
  }
  return { ok: true, location }
}
