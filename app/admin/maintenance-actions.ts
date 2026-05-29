'use server'

import { randomUUID } from 'crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit-log'
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  parseCustomPresets,
  type PlatformMaintenanceState,
  type SavedMaintenancePreset,
} from '@/lib/platform-maintenance'

function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'No autorizado.', supabase, user: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return { ok: false as const, message: 'Solo administradores.', supabase, user: null }
  }

  return { ok: true as const, message: '', supabase, user }
}

function mapRow(
  row: {
    enabled: boolean
    message: string
    updated_at: string | null
    updated_by: string | null
    custom_presets?: unknown
  },
  updatedByEmail: string | null,
): PlatformMaintenanceState {
  return {
    enabled: Boolean(row.enabled),
    message: row.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: row.updated_at,
    updatedByEmail,
    customPresets: parseCustomPresets(row.custom_presets),
  }
}

async function fetchMaintenanceRow(service: ReturnType<typeof getServiceClient>) {
  if (!service) return null
  const { data, error } = await service
    .from('platform_maintenance')
    .select('enabled, message, updated_at, updated_by, custom_presets')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  return data
}

export async function getMaintenanceModeAction(): Promise<PlatformMaintenanceState | null> {
  const service = getServiceClient()
  const data = await fetchMaintenanceRow(service)
  if (!data || !service) return null

  let updatedByEmail: string | null = null
  if (data.updated_by) {
    const { data: profile } = await service
      .from('profiles')
      .select('email')
      .eq('id', data.updated_by)
      .maybeSingle()
    updatedByEmail = profile?.email ?? null
  }

  return mapRow(data, updatedByEmail)
}

/** Used at login — no session required. */
export async function getMaintenanceModePublicAction(): Promise<{
  enabled: boolean
  message: string
}> {
  const state = await getMaintenanceModeAction()
  return {
    enabled: state?.enabled ?? false,
    message: state?.message ?? DEFAULT_MAINTENANCE_MESSAGE,
  }
}

export async function updateMaintenanceModeAction(input: {
  enabled: boolean
  message: string
}): Promise<{ ok: boolean; message: string; state?: PlatformMaintenanceState }> {
  const auth = await requireAdmin()
  if (!auth.ok || !auth.user) return { ok: false, message: auth.message }

  const message = input.message.trim() || DEFAULT_MAINTENANCE_MESSAGE
  const enabled = Boolean(input.enabled)

  const { data: previous } = await auth.supabase
    .from('platform_maintenance')
    .select('enabled, message, custom_presets')
    .eq('id', 1)
    .maybeSingle()

  const { error } = await auth.supabase
    .from('platform_maintenance')
    .upsert({
      id: 1,
      enabled,
      message,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
      custom_presets: previous?.custom_presets ?? [],
    })

  if (error) {
    return { ok: false, message: error.message }
  }

  void logAudit(auth.supabase, {
    action_type: 'UPDATE_MAINTENANCE_MODE',
    description: enabled
      ? 'Activó modo mantenimiento (clientes bloqueados)'
      : 'Desactivó modo mantenimiento',
    target_type: 'system',
    target_label: 'Modo mantenimiento',
    metadata: {
      enabled,
      message,
      previous_enabled: previous?.enabled ?? false,
      previous_message: previous?.message ?? null,
    },
  })

  const state = await getMaintenanceModeAction()
  return {
    ok: true,
    message: enabled
      ? 'Modo mantenimiento activado. Clientes y subusuarios no pueden iniciar sesión.'
      : 'Modo mantenimiento desactivado. Los clientes pueden iniciar sesión.',
    state: state ?? undefined,
  }
}

export async function createMaintenancePresetAction(input: {
  label: string
  message: string
}): Promise<{ ok: boolean; message: string; state?: PlatformMaintenanceState }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const label = input.label.trim()
  const message = input.message.trim()
  if (!label) return { ok: false, message: 'Escribe un nombre para la plantilla.' }
  if (!message) return { ok: false, message: 'El mensaje no puede estar vacío.' }
  if (label.length > 80) return { ok: false, message: 'El nombre es demasiado largo (máx. 80 caracteres).' }

  const { data: row } = await auth.supabase
    .from('platform_maintenance')
    .select('custom_presets')
    .eq('id', 1)
    .maybeSingle()

  const existing = parseCustomPresets(row?.custom_presets)
  if (existing.some((p) => p.label.toLowerCase() === label.toLowerCase())) {
    return { ok: false, message: 'Ya existe una plantilla con ese nombre.' }
  }

  const preset = {
    id: randomUUID(),
    label,
    message,
    created_at: new Date().toISOString(),
  }

  const { error } = await auth.supabase
    .from('platform_maintenance')
    .update({ custom_presets: [...existing, preset] })
    .eq('id', 1)

  if (error) {
    if (error.message.includes('custom_presets')) {
      return {
        ok: false,
        message: 'Falta la migración 042_maintenance_custom_presets.sql en Supabase.',
      }
    }
    return { ok: false, message: error.message }
  }

  void logAudit(auth.supabase, {
    action_type: 'UPDATE_MAINTENANCE_MODE',
    description: `Creó plantilla de mantenimiento: ${label}`,
    target_type: 'system',
    target_label: label,
    metadata: { preset_id: preset.id },
  })

  const state = await getMaintenanceModeAction()
  return { ok: true, message: 'Plantilla guardada.', state: state ?? undefined }
}

export async function deleteMaintenancePresetAction(
  presetId: string,
): Promise<{ ok: boolean; message: string; state?: PlatformMaintenanceState }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const id = presetId.trim()
  if (!id) return { ok: false, message: 'Plantilla no válida.' }

  const { data: row } = await auth.supabase
    .from('platform_maintenance')
    .select('custom_presets')
    .eq('id', 1)
    .maybeSingle()

  const existing = parseCustomPresets(row?.custom_presets)
  const removed = existing.find((p) => p.id === id)
  if (!removed) return { ok: false, message: 'No se encontró la plantilla.' }

  const { error } = await auth.supabase
    .from('platform_maintenance')
    .update({ custom_presets: existing.filter((p) => p.id !== id) })
    .eq('id', 1)

  if (error) return { ok: false, message: error.message }

  void logAudit(auth.supabase, {
    action_type: 'UPDATE_MAINTENANCE_MODE',
    description: `Eliminó plantilla de mantenimiento: ${removed.label}`,
    target_type: 'system',
    target_label: removed.label,
    metadata: { preset_id: id },
  })

  const state = await getMaintenanceModeAction()
  return { ok: true, message: 'Plantilla eliminada.', state: state ?? undefined }
}
