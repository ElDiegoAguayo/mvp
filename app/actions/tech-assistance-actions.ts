'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  calculateTechAmounts,
  type TechBillingUnit,
  type TechProformaStatus,
} from '@/lib/tech-assistance/types'
import {
  canApproveTechProforma,
  canCreateTechEntry,
  canGenerateTechProforma,
  canManageTechServices,
  canManageTechAssistance,
  isTechInspectorProfile,
} from '@/lib/tech-assistance/roles'
import {
  fetchInspectorClientOptions,
  inspectorCanAccessClient,
  type InspectorClientOption,
} from '@/lib/tech-assistance/inspector-clients'
import {
  assertWithinGeofence,
  requireGeofenceLocation,
  resolveLocationForEntry,
} from '@/lib/tech-assistance/location-validation'
import { todayWorkDateISO } from '@/lib/tech-assistance/work-date'
import { getViewAsContext } from '@/lib/impersonation'

const REVALIDATE = '/dashboard/asistencia-tecnica'

type ActionResult = { ok: true; id?: string } | { ok: false; message: string }

async function requireAuth() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      supabase,
      user: null,
      actingUserId: null,
      isAdmin: false,
      isInspector: false,
      isSupportMode: false,
      canManage: false,
      profile: null,
    }
  }

  const viewAs = await getViewAsContext()
  const isSupportMode = !!viewAs.viewAsUserId
  const actingUserId = viewAs.viewAsUserId ?? user.id

  const { data: sessionProfile } = await supabase
    .from('profiles')
    .select('id, role, parent_user_id, full_name, email, is_tech_inspector')
    .eq('id', user.id)
    .single()

  const loggedInIsAdmin = sessionProfile?.role === 'admin'

  const { data: actingProfile } =
    actingUserId === user.id
      ? { data: sessionProfile }
      : await supabase
          .from('profiles')
          .select('id, role, parent_user_id, full_name, email, is_tech_inspector')
          .eq('id', actingUserId)
          .single()

  // En modo soporte se aplican permisos del usuario impersonado, no del admin.
  const isAdmin = loggedInIsAdmin && !isSupportMode
  const isInspector = isTechInspectorProfile(actingProfile)
  const profile = actingProfile

  return {
    supabase,
    user,
    actingUserId,
    isAdmin,
    isInspector,
    isSupportMode,
    canManage: canManageTechAssistance(profile, isAdmin),
    profile,
  }
}

function resolveOwnerIdFromProfile(
  userId: string,
  isAdmin: boolean,
  isInspector: boolean,
  profile: { parent_user_id: string | null } | null,
  explicitClientId?: string | null,
) {
  if (explicitClientId && (isAdmin || isInspector)) return explicitClientId
  if (profile?.parent_user_id && !isInspector) return profile.parent_user_id
  return userId
}

export async function listTechInspectorClientsAction(): Promise<
  { ok: true; clients: InspectorClientOption[] } | { ok: false; message: string }
> {
  const { supabase, actingUserId, isInspector } = await requireAuth()
  if (!actingUserId) return { ok: false, message: 'No autenticado.' }
  if (!isInspector) return { ok: false, message: 'No aplica.' }

  const clients = await fetchInspectorClientOptions(supabase, actingUserId)
  return { ok: true, clients }
}

export async function upsertTechServiceAction(input: {
  id?: string
  clientUserId?: string
  name: string
  billing_unit: TechBillingUnit
  unit_price_net: number
  period_start?: string | null
  period_end?: string | null
  location_label?: string | null
  location_id?: string | null
}): Promise<ActionResult> {
  const { supabase, user, actingUserId, isAdmin, profile } = await requireAuth()
  if (!user || !actingUserId) return { ok: false, message: 'No autenticado.' }
  if (!canManageTechServices(isAdmin)) {
    return { ok: false, message: 'Solo administradores pueden gestionar servicios.' }
  }

  const periodStart = input.period_start?.trim() || null
  const periodEnd = input.period_end?.trim() || null
  if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
    return { ok: false, message: 'Indica fecha de inicio y fin de la tarea.' }
  }
  if (periodStart && periodEnd && periodEnd < periodStart) {
    return { ok: false, message: 'La fecha de fin debe ser igual o posterior al inicio.' }
  }

  const ownerId = resolveOwnerIdFromProfile(
    actingUserId,
    isAdmin,
    false,
    profile,
    input.clientUserId,
  )

  const row = {
    user_id: ownerId,
    name: input.name.trim(),
    billing_unit: input.billing_unit,
    unit_price_net: input.unit_price_net,
    period_start: periodStart,
    period_end: periodEnd,
    location_label: input.location_label?.trim() || null,
    location_id: input.location_id || null,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await supabase.from('tech_assistance_services').update(row).eq('id', input.id)
    if (error) return { ok: false, message: error.message }
    revalidatePath(REVALIDATE)
    return { ok: true, id: input.id }
  }

  const { data, error } = await supabase
    .from('tech_assistance_services')
    .insert(row)
    .select('id')
    .single()

  if (error) return { ok: false, message: error.message }
  revalidatePath(REVALIDATE)
  return { ok: true, id: data.id }
}

export async function createTechEntryAction(input: {
  clientUserId?: string
  service_id: string
  work_date: string
  inspector_name: string
  started_at?: string | null
  ended_at?: string | null
  check_in_lat?: number | null
  check_in_lng?: number | null
  check_out_lat?: number | null
  check_out_lng?: number | null
  quantity?: number
  location_label?: string
  location_id?: string | null
  attendance_value?: number
  regular_hours?: number | null
  overtime_hours?: number | null
  notes?: string
}): Promise<ActionResult> {
  const { supabase, user, actingUserId, isAdmin, isInspector, profile } = await requireAuth()
  if (!user || !actingUserId) return { ok: false, message: 'No autenticado.' }

  if (!canCreateTechEntry(isAdmin, isInspector)) {
    return {
      ok: false,
      message: 'Solo inspectores en campo o administradores Up Crop pueden registrar asistencia.',
    }
  }

  if (isInspector && !input.clientUserId) {
    return { ok: false, message: 'Selecciona el cliente donde estás trabajando.' }
  }

  const ownerId = resolveOwnerIdFromProfile(
    actingUserId,
    isAdmin,
    isInspector,
    profile,
    input.clientUserId,
  )

  if (isInspector && input.clientUserId) {
    const allowed = await inspectorCanAccessClient(supabase, actingUserId, input.clientUserId)
    if (!allowed) {
      return { ok: false, message: 'No tienes acceso a ese cliente.' }
    }
  }

  const inspectorName = isInspector
    ? profile?.full_name?.trim() || profile?.email?.trim() || 'Inspector'
    : input.inspector_name.trim()

  const { data: service, error: serviceError } = await supabase
    .from('tech_assistance_services')
    .select('billing_unit, unit_price_net')
    .eq('id', input.service_id)
    .eq('user_id', ownerId)
    .single()

  if (serviceError || !service) {
    return { ok: false, message: 'Servicio no encontrado.' }
  }

  if (isInspector) {
    const locRequired = await requireGeofenceLocation(supabase, {
      ownerId,
      serviceId: input.service_id,
    })
    if (!locRequired.ok) return { ok: false, message: locRequired.message }

    if (input.check_in_lat != null && input.check_in_lng != null) {
      const fence = await assertWithinGeofence(supabase, {
        ownerId,
        serviceId: input.service_id,
        locationId: input.location_id ?? locRequired.location.id,
        lat: input.check_in_lat,
        lng: input.check_in_lng,
      })
      if (!fence.ok) return { ok: false, message: fence.message }
    }

    if (input.check_out_lat != null && input.check_out_lng != null) {
      const fenceOut = await assertWithinGeofence(supabase, {
        ownerId,
        serviceId: input.service_id,
        locationId: input.location_id ?? locRequired.location.id,
        lat: input.check_out_lat,
        lng: input.check_out_lng,
      })
      if (!fenceOut.ok) return { ok: false, message: fenceOut.message }
    }
  }

  const resolvedLocation = await resolveLocationForEntry(supabase, {
    ownerId,
    serviceId: input.service_id,
    locationId: input.location_id,
  })

  const workDate = isInspector ? todayWorkDateISO() : input.work_date
  if (isInspector && input.work_date !== workDate) {
    return { ok: false, message: 'Solo puedes registrar asistencia del día de hoy.' }
  }

  const quantity = Number(input.quantity) || 0
  const amounts = calculateTechAmounts(quantity, Number(service.unit_price_net))
  const attendanceValue = input.attendance_value != null ? Number(input.attendance_value) : 1

  const { data, error } = await supabase
    .from('tech_assistance_entries')
    .insert({
      user_id: ownerId,
      service_id: input.service_id,
      work_date: workDate,
      inspector_name: inspectorName,
      started_at: input.started_at ?? null,
      ended_at: input.ended_at ?? null,
      check_in_lat: input.check_in_lat ?? null,
      check_in_lng: input.check_in_lng ?? null,
      check_out_lat: input.check_out_lat ?? null,
      check_out_lng: input.check_out_lng ?? null,
      billing_unit: service.billing_unit,
      quantity,
      unit_price_net: service.unit_price_net,
      ...amounts,
      location_label:
        input.location_label?.trim() || resolvedLocation?.name || null,
      location_id: resolvedLocation?.id ?? input.location_id ?? null,
      attendance_value: attendanceValue,
      regular_hours: input.regular_hours ?? null,
      overtime_hours: input.overtime_hours ?? null,
      notes: input.notes?.trim() || null,
      created_by: actingUserId,
    })
    .select('id')
    .single()

  if (error) return { ok: false, message: error.message }
  revalidatePath(REVALIDATE)
  return { ok: true, id: data.id }
}

export async function updateTechEntryAction(input: {
  id: string
  service_id?: string
  work_date?: string
  inspector_name?: string
  started_at?: string | null
  ended_at?: string | null
  check_in_lat?: number | null
  check_in_lng?: number | null
  check_out_lat?: number | null
  check_out_lng?: number | null
  quantity?: number
  location_label?: string
  location_id?: string | null
  attendance_value?: number
  regular_hours?: number | null
  overtime_hours?: number | null
  notes?: string
}): Promise<ActionResult> {
  const { supabase, user, actingUserId, isAdmin, isInspector } = await requireAuth()
  if (!user || !actingUserId) return { ok: false, message: 'No autenticado.' }

  const { data: entry, error: fetchError } = await supabase
    .from('tech_assistance_entries')
    .select('id, user_id, created_by, proforma_id, service_id, quantity, unit_price_net, billing_unit, work_date')
    .eq('id', input.id)
    .single()

  if (fetchError || !entry) return { ok: false, message: 'Registro no encontrado.' }
  if (entry.proforma_id) return { ok: false, message: 'No se puede editar un registro en proforma.' }

  if (isInspector && entry.created_by !== actingUserId) {
    return { ok: false, message: 'No puedes editar este registro.' }
  }
  if (isInspector) {
    const today = todayWorkDateISO()
    if (entry.work_date !== today) {
      return { ok: false, message: 'Solo puedes editar registros del día de hoy.' }
    }
    if (input.work_date != null && input.work_date !== today) {
      return { ok: false, message: 'No puedes cambiar la fecha del registro.' }
    }
  }
  if (!isInspector && !isAdmin) {
    return { ok: false, message: 'No tienes permiso para editar registros.' }
  }

  let billingUnit = entry.billing_unit
  let unitPriceNet = Number(entry.unit_price_net)
  let serviceId = entry.service_id

  if (input.service_id && input.service_id !== entry.service_id) {
    const { data: service, error: serviceError } = await supabase
      .from('tech_assistance_services')
      .select('billing_unit, unit_price_net')
      .eq('id', input.service_id)
      .eq('user_id', entry.user_id)
      .single()
    if (serviceError || !service) return { ok: false, message: 'Servicio no encontrado.' }
    billingUnit = service.billing_unit
    unitPriceNet = Number(service.unit_price_net)
    serviceId = input.service_id
  }

  const quantity = input.quantity != null ? Number(input.quantity) || 0 : Number(entry.quantity) || 0
  const amounts = calculateTechAmounts(quantity, unitPriceNet)

  const patch: Record<string, unknown> = {
    service_id: serviceId,
    billing_unit: billingUnit,
    quantity,
    unit_price_net: unitPriceNet,
    ...amounts,
    updated_at: new Date().toISOString(),
  }

  if (input.work_date != null) patch.work_date = input.work_date
  if (input.inspector_name != null && !isInspector) {
    patch.inspector_name = input.inspector_name.trim()
  }
  if (input.started_at !== undefined) patch.started_at = input.started_at
  if (input.ended_at !== undefined) patch.ended_at = input.ended_at
  if (input.check_in_lat !== undefined) patch.check_in_lat = input.check_in_lat
  if (input.check_in_lng !== undefined) patch.check_in_lng = input.check_in_lng
  if (input.check_out_lat !== undefined) patch.check_out_lat = input.check_out_lat
  if (input.check_out_lng !== undefined) patch.check_out_lng = input.check_out_lng
  if (input.location_label !== undefined) patch.location_label = input.location_label.trim() || null
  if (input.attendance_value != null) patch.attendance_value = Number(input.attendance_value)
  if (input.regular_hours !== undefined) patch.regular_hours = input.regular_hours
  if (input.overtime_hours !== undefined) patch.overtime_hours = input.overtime_hours
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null

  const { error } = await supabase.from('tech_assistance_entries').update(patch).eq('id', input.id)
  if (error) return { ok: false, message: error.message }
  revalidatePath(REVALIDATE)
  return { ok: true, id: input.id }
}

export async function deleteTechEntryAction(entryId: string): Promise<ActionResult> {
  const { supabase, user, actingUserId, isAdmin, isInspector } = await requireAuth()
  if (!user || !actingUserId) return { ok: false, message: 'No autenticado.' }

  if (isInspector) {
    const { data: entry } = await supabase
      .from('tech_assistance_entries')
      .select('id, created_by, proforma_id, work_date')
      .eq('id', entryId)
      .single()
    if (!entry || entry.created_by !== actingUserId || entry.proforma_id) {
      return { ok: false, message: 'No puedes eliminar este registro.' }
    }
    if (entry.work_date !== todayWorkDateISO()) {
      return { ok: false, message: 'Solo puedes eliminar registros del día de hoy.' }
    }
  } else if (!isAdmin) {
    return { ok: false, message: 'No tienes permiso para eliminar registros.' }
  } else {
    const { data: entry } = await supabase
      .from('tech_assistance_entries')
      .select('id, proforma_id')
      .eq('id', entryId)
      .single()
    if (entry?.proforma_id) {
      return { ok: false, message: 'No se puede eliminar un registro en proforma.' }
    }
  }

  const { error } = await supabase.from('tech_assistance_entries').delete().eq('id', entryId)
  if (error) return { ok: false, message: error.message }
  revalidatePath(REVALIDATE)
  return { ok: true }
}

function nextProformaNumber(existing: string[]): string {
  const year = new Date().getFullYear()
  const prefix = `PF-${year}-`
  const nums = existing
    .filter(n => n.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, ''), 10))
    .filter(n => !Number.isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function generateTechProformaAction(input: {
  clientUserId?: string
  period_start: string
  period_end: string
  sendForApproval?: boolean
}): Promise<ActionResult> {
  const { supabase, user, actingUserId, isAdmin, profile } = await requireAuth()
  if (!user || !actingUserId) return { ok: false, message: 'No autenticado.' }
  if (!canGenerateTechProforma(isAdmin)) {
    return { ok: false, message: 'Solo administradores pueden generar proformas.' }
  }

  const ownerId = resolveOwnerIdFromProfile(
    actingUserId,
    isAdmin,
    false,
    profile,
    input.clientUserId,
  )

  const { data: entries, error: entriesError } = await supabase
    .from('tech_assistance_entries')
    .select('id, amount_net, amount_iva, amount_total')
    .eq('user_id', ownerId)
    .is('proforma_id', null)
    .gte('work_date', input.period_start)
    .lte('work_date', input.period_end)

  if (entriesError) return { ok: false, message: entriesError.message }
  const billableEntries = (entries ?? []).filter(e => Number(e.amount_total) > 0)
  if (!billableEntries.length) {
    return {
      ok: false,
      message: 'No hay registros con cantidad facturable en ese rango (completa avances o revisa fechas).',
    }
  }

  const { data: existingNumbers } = await supabase
    .from('tech_assistance_proformas')
    .select('proforma_number')
    .eq('user_id', ownerId)

  const proforma_number = nextProformaNumber((existingNumbers ?? []).map(r => r.proforma_number))

  const subtotal_net = billableEntries.reduce((s, e) => s + Number(e.amount_net), 0)
  const iva_amount = billableEntries.reduce((s, e) => s + Number(e.amount_iva), 0)
  const total_amount = billableEntries.reduce((s, e) => s + Number(e.amount_total), 0)

  const status: TechProformaStatus = input.sendForApproval ? 'pending_approval' : 'draft'

  const { data: proforma, error: proformaError } = await supabase
    .from('tech_assistance_proformas')
    .insert({
      user_id: ownerId,
      proforma_number,
      period_start: input.period_start,
      period_end: input.period_end,
      status,
      subtotal_net: Math.round(subtotal_net * 100) / 100,
      iva_amount: Math.round(iva_amount * 100) / 100,
      total_amount: Math.round(total_amount * 100) / 100,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (proformaError || !proforma) {
    return { ok: false, message: proformaError?.message ?? 'Error al crear proforma.' }
  }

  const { error: linkError } = await supabase
    .from('tech_assistance_entries')
    .update({ proforma_id: proforma.id, updated_at: new Date().toISOString() })
    .in(
      'id',
      billableEntries.map(e => e.id),
    )

  if (linkError) return { ok: false, message: linkError.message }

  revalidatePath(REVALIDATE)
  return { ok: true, id: proforma.id }
}

export async function updateTechProformaStatusAction(
  proformaId: string,
  status: TechProformaStatus,
): Promise<ActionResult> {
  const { supabase, user, isAdmin, profile } = await requireAuth()
  if (!user) return { ok: false, message: 'No autenticado.' }

  if (isAdmin) {
    // Admin puede cambiar cualquier estado
  } else if (status === 'approved' || status === 'rejected') {
    if (!canApproveTechProforma(profile, false)) {
      return { ok: false, message: 'No tienes permiso para gestionar proformas.' }
    }
  } else {
    return { ok: false, message: 'No tienes permiso para cambiar ese estado.' }
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'approved') {
    patch.approved_at = new Date().toISOString()
  }

  const { error } = await supabase.from('tech_assistance_proformas').update(patch).eq('id', proformaId)
  if (error) return { ok: false, message: error.message }

  revalidatePath(REVALIDATE)
  return { ok: true }
}

export async function sendTechProformaForApprovalAction(proformaId: string): Promise<ActionResult> {
  const { user, isAdmin } = await requireAuth()
  if (!user) return { ok: false, message: 'No autenticado.' }
  if (!canGenerateTechProforma(isAdmin)) {
    return { ok: false, message: 'Solo administradores pueden enviar proformas.' }
  }
  return updateTechProformaStatusAction(proformaId, 'pending_approval')
}

export async function approveTechProformaAction(proformaId: string): Promise<ActionResult> {
  return updateTechProformaStatusAction(proformaId, 'approved')
}

export async function rejectTechProformaAction(proformaId: string): Promise<ActionResult> {
  const { supabase, user, isAdmin, profile } = await requireAuth()
  if (!user) return { ok: false, message: 'No autenticado.' }
  if (!canApproveTechProforma(profile, isAdmin)) {
    return { ok: false, message: 'No tienes permiso para rechazar proformas.' }
  }

  const { error: statusError } = await supabase
    .from('tech_assistance_proformas')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', proformaId)

  if (statusError) return { ok: false, message: statusError.message }

  const { error: unlockError } = await supabase
    .from('tech_assistance_entries')
    .update({ proforma_id: null, updated_at: new Date().toISOString() })
    .eq('proforma_id', proformaId)

  if (unlockError) return { ok: false, message: unlockError.message }

  revalidatePath(REVALIDATE)
  return { ok: true }
}
