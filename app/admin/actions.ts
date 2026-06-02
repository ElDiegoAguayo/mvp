'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { LocalizedText } from '@/lib/i18n/localized-text'
import {
  insertAdminNotification,
  listAdminNotifications,
  updateAdminNotification,
} from '@/lib/admin/admin-notifications-db'
import { logAudit } from '@/lib/audit-log'
import {
  isSameIp,
  PRIVATE_IP_RE,
  resolveClientIp,
} from '@/lib/client-ip'
import {
  DEFAULT_STORAGE_QUOTA_GB,
  formatQuotaLimit,
  getStoragePlanById,
  isStoragePlanId,
  resolveStoragePlanId,
  resolveStorageQuotaBytes,
} from '@/lib/vault-storage'
import { isServicePlanId, type ServicePlanId } from '@/lib/subscription-plans'
import {
  buildServicePlanSubscriptionInfo,
  computeServicePlanExpiresAt,
  isMissingServicePlanDateColumns,
  type ServicePlanSubscriptionStatus,
} from '@/lib/service-plan-subscription'
import { syncInspectorModulesOnly } from '@/lib/admin/sync-inspector-modules'
import {
  applyPrincipalClientFilters,
  isPrincipalClientProfile,
} from '@/lib/profiles/principal-clients'

async function getAdminKnownIps(adminClient: Awaited<ReturnType<typeof getAdminClient>>, email: string): Promise<string[]> {
  const { data } = await adminClient
    .from('login_attempts')
    .select('ip_address')
    .eq('email', email.toLowerCase().trim())
    .order('attempted_at', { ascending: false })
    .limit(30)

  return [...new Set((data ?? []).map(r => r.ip_address).filter(Boolean) as string[])]
}

async function isAdminOwnIp(adminClient: Awaited<ReturnType<typeof getAdminClient>>, email: string | null | undefined, ip: string): Promise<boolean> {
  const sessionIp = await resolveClientIp()
  if (isSameIp(ip, sessionIp)) return true
  if (!email) return false
  const knownIps = await getAdminKnownIps(adminClient, email)
  return knownIps.some(known => isSameIp(ip, known))
}

export interface AdminSecurityContext {
  email: string | null
  sessionIp: string | null
  knownIps: string[]
}

/** Returns admin email + IPs associated with their login history (for self-block guards). */
export async function getCurrentAdminSecurityContextAction(): Promise<AdminSecurityContext | null> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return null

  const { data: callerProfile } = await supabase.from('profiles').select('role, email').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return null

  const adminClient = await getAdminClient()
  const email = callerProfile.email ?? caller.email ?? null
  const knownIps = email ? await getAdminKnownIps(adminClient, email) : []

  return {
    email,
    sessionIp: await resolveClientIp(),
    knownIps,
  }
}

/** @deprecated Use getCurrentAdminSecurityContextAction */
export async function getCurrentAdminIpAction(): Promise<string | null> {
  const ctx = await getCurrentAdminSecurityContextAction()
  return ctx?.sessionIp ?? ctx?.knownIps[0] ?? null
}

export interface IpGeoInfo {
  country: string
  countryCode: string
  city: string
}

/** Resolve country/city for public IPs (server-side, ip-api.com). */
export async function getIpGeolocationsAction(ips: string[]): Promise<Record<string, IpGeoInfo | null>> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return {}

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return {}

  const unique = [...new Set(
    ips.map(ip => ip?.trim()).filter((ip): ip is string => !!ip && !PRIVATE_IP_RE.test(ip))
  )]

  const result: Record<string, IpGeoInfo | null> = {}
  if (unique.length === 0) return result

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)
    try {
      const res = await fetch('http://ip-api.com/batch?fields=status,country,countryCode,city,query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        chunk.forEach(ip => { result[ip] = null })
        continue
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        for (const item of data) {
          if (!item?.query) continue
          result[item.query] = item.status === 'success'
            ? { country: item.country, countryCode: item.countryCode, city: item.city ?? '' }
            : null
        }
      }
    } catch {
      chunk.forEach(ip => { result[ip] = null })
    }
  }

  return result
}

export type CreateUserState = {
  ok: boolean
  message: string
  userId?: string
}

/**
 * Create a new client account.
 *
 * Uses Supabase Admin API with the Service Role Key on the server, which never
 * touches the current admin's session (no signInWithPassword side-effect).
 * The caller must be an authenticated admin: we verify by reading the
 * profile of the current logged-in user before issuing the admin call.
 */
export async function createUserAction(
  _prev: CreateUserState | undefined,
  formData: FormData,
): Promise<CreateUserState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()
  const role = String(formData.get('role') ?? 'user')

  if (!email || !password || !fullName) {
    return { ok: false, message: 'Todos los campos son obligatorios.' }
  }
  if (password.length < 8) {
    return {
      ok: false,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    }
  }
  if (!['admin', 'user'].includes(role)) {
    return { ok: false, message: 'Rol inválido.' }
  }

  // 1. Verify the caller is an admin.
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden crear usuarios.' }
  }

  // 2. Create the user with the service-role client. This is a separate client
  // (does not share or mutate cookies / the current admin session).
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      message:
        'Configuración del servidor incompleta. Falta SUPABASE_SERVICE_ROLE_KEY.',
    }
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation, treat as verified.
      user_metadata: { full_name: fullName },
    })

  if (createError || !created.user) {
    const msg = createError?.message ?? 'No se pudo crear el usuario.'
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('exists')) {
      return { ok: false, message: 'Ya existe un usuario con ese email.' }
    }
    return { ok: false, message: msg }
  }

  // 3. The handle_new_user trigger inserts a row into public.profiles with role 'user'.
  // We update the row to reflect the form values (full_name + role).
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      role,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', created.user.id)

  if (profileError) {
    return {
      ok: false,
      message: `Usuario creado, pero falló la actualización del perfil: ${profileError.message}`,
    }
  }

  // Resolve the caller's display name for the audit log
  const { data: callerForLog } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', caller.id)
    .single()

  const actorLabel =
    callerForLog?.full_name || callerForLog?.email || 'Admin'

  await logAudit(
    adminClient,
    {
      action_type: 'CREATE_USER',
      target_type: 'user',
      target_id: created.user.id,
      target_label: email,
      description: `${actorLabel} creó la cuenta ${email} (${fullName}) con rol ${role}.`,
      metadata: { role, full_name: fullName },
    },
    {
      actor_id: caller.id,
      actor_email: callerForLog?.email ?? caller.email ?? null,
      actor_name: callerForLog?.full_name ?? null,
    },
  )

  revalidatePath('/admin')
  return {
    ok: true,
    message: `Cuenta creada para ${fullName} (${email}).`,
    userId: created.user.id,
  }
}

export type SendUserInviteState = {
  ok: boolean
  message: string
}

export type InviteUserState = {
  ok: boolean
  message: string
  userId?: string
}

async function requireAdminCaller() {
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { supabase, caller: null, isAdmin: false as const }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', caller.id)
    .single()

  return {
    supabase,
    caller,
    isAdmin: callerProfile?.role === 'admin',
    callerProfile,
  }
}

function formatAuthEmailError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('error sending invite email') ||
    lower.includes('error sending recovery email') ||
    lower.includes('error sending email')
  ) {
    return (
      'No se pudo enviar el correo de invitación. Revisa Supabase → Authentication → Logs para el detalle. ' +
      'Causas habituales: dominio no verificado en Resend, remitente distinto al dominio (ej. noreply@tudominio.cl), ' +
      'API key incorrecta en SMTP, o plantilla Invite user con error.'
    )
  }
  if (lower.includes('rate limit') || lower.includes('email rate limit')) {
    return 'Límite de correos alcanzado. Espera unos minutos o revisa Rate Limits en Supabase.'
  }
  return message
}

/**
 * Sends a registration invite email to an existing user (or resends if pending).
 * Uses Supabase Auth emails — configure SMTP/templates in the Supabase dashboard.
 */
export async function sendUserRegistrationInviteAction(
  userId: string,
): Promise<SendUserInviteState> {
  const { supabase, caller, isAdmin, callerProfile } = await requireAdminCaller()
  if (!caller) return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  if (!isAdmin) return { ok: false, message: 'Solo administradores pueden enviar invitaciones.' }

  const trimmedId = userId.trim()
  if (!trimmedId) return { ok: false, message: 'Usuario no válido.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_active')
    .eq('id', trimmedId)
    .maybeSingle()

  if (!profile?.email) {
    return { ok: false, message: 'Este usuario no tiene correo registrado.' }
  }

  const email = profile.email.trim().toLowerCase()

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return { ok: false, message: 'Configuración del servidor incompleta para enviar correos.' }
  }

  const { buildAuthCallbackUrl } = await import('@/lib/auth/site-url')
  const inviteRedirect = buildAuthCallbackUrl('/auth/registro')
  const welcomeRedirect = buildAuthCallbackUrl('/auth/registro?flow=welcome')

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authLookupError } =
    await adminClient.auth.admin.getUserById(trimmedId)

  if (authLookupError && !authLookupError.message.toLowerCase().includes('not found')) {
    return { ok: false, message: authLookupError.message }
  }

  const authUser = authData?.user
  let delivery: 'invite' | 'welcome' = 'invite'

  if (!authUser) {
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteRedirect,
    })
    if (error) return { ok: false, message: formatAuthEmailError(error.message) }
  } else if (authUser.invited_at && !authUser.email_confirmed_at) {
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteRedirect,
    })
    if (error) return { ok: false, message: formatAuthEmailError(error.message) }
  } else {
    delivery = 'welcome'
    const anonClient = createSupabaseClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await anonClient.auth.resetPasswordForEmail(email, {
      redirectTo: welcomeRedirect,
    })
    if (error) return { ok: false, message: formatAuthEmailError(error.message) }
  }

  const actorLabel =
    callerProfile?.full_name || callerProfile?.email || 'Admin'

  await logAudit(
    adminClient,
    {
      action_type: 'SEND_USER_INVITE',
      target_type: 'user',
      target_id: trimmedId,
      target_label: email,
      description: `${actorLabel} envió invitación de registro a ${email}.`,
      metadata: { delivery },
    },
    {
      actor_id: caller.id,
      actor_email: callerProfile?.email ?? caller.email ?? null,
      actor_name: callerProfile?.full_name ?? null,
    },
  )

  revalidatePath('/admin')
  return {
    ok: true,
    message: `Enviamos un enlace a ${email} para que active su cuenta.`,
  }
}

/**
 * Creates a user by email invitation (no admin-chosen password).
 * The invitee completes registration via the link in their inbox.
 */
export async function inviteUserByEmailAction(
  _prev: InviteUserState | undefined,
  formData: FormData,
): Promise<InviteUserState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = String(formData.get('role') ?? 'user')

  if (!email) {
    return { ok: false, message: 'El correo es obligatorio.' }
  }
  if (!['admin', 'user'].includes(role)) {
    return { ok: false, message: 'Rol inválido.' }
  }

  const { supabase, caller, isAdmin, callerProfile } = await requireAdminCaller()
  if (!caller) return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  if (!isAdmin) return { ok: false, message: 'Solo administradores pueden invitar usuarios.' }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, message: 'Configuración del servidor incompleta.' }
  }

  const { buildAuthCallbackUrl } = await import('@/lib/auth/site-url')
  const redirectTo = buildAuthCallbackUrl('/auth/registro')

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: invited, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    })

  if (inviteError || !invited.user) {
    const msg = inviteError?.message ?? 'No se pudo enviar la invitación.'
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('exists')) {
      return { ok: false, message: 'Ya existe un usuario con ese email.' }
    }
    return { ok: false, message: formatAuthEmailError(msg) }
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: null,
      email,
      role,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invited.user.id)

  if (profileError) {
    return {
      ok: false,
      message: `Invitación enviada, pero falló la actualización del perfil: ${profileError.message}`,
    }
  }

  const actorLabel =
    callerProfile?.full_name || callerProfile?.email || 'Admin'

  await logAudit(
    adminClient,
    {
      action_type: 'SEND_USER_INVITE',
      target_type: 'user',
      target_id: invited.user.id,
      target_label: email,
      description: `${actorLabel} invitó por correo a ${email} con rol ${role}.`,
      metadata: { role, created: true },
    },
    {
      actor_id: caller.id,
      actor_email: callerProfile?.email ?? caller.email ?? null,
      actor_name: callerProfile?.full_name ?? null,
    },
  )

  revalidatePath('/admin')
  return {
    ok: true,
    message: `Enviamos un enlace a ${email} para que active su cuenta.`,
    userId: invited.user.id,
  }
}

export type UpdateUserState = {
  ok: boolean
  message: string
}

export type CreateSubuserState = {
  ok: boolean
  message: string
  userId?: string
}

async function finalizeSubuserAccount(
  adminClient: ReturnType<typeof createSupabaseClient>,
  opts: {
    subuserId: string
    email: string
    parentUserId: string
    fullName: string | null
  },
): Promise<{ ok: true; parentLabel: string } | { ok: false; message: string }> {
  const { subuserId, email, parentUserId, fullName } = opts

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      role: 'user' as const,
      is_active: true,
      parent_user_id: parentUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subuserId)

  if (profileError) {
    return {
      ok: false,
      message: `Falló la actualización del perfil: ${profileError.message}`,
    }
  }

  let parentLabel = parentUserId

  try {
    const [moduleAccessRes, tableAccessRes, chartAccessRes, parentProfileRes] =
      await Promise.all([
        adminClient
          .from('user_module_access')
          .select('module_id, enabled, display_order')
          .eq('user_id', parentUserId)
          .eq('enabled', true),
        adminClient
          .from('user_table_access')
          .select('table_id, can_view')
          .eq('user_id', parentUserId),
        adminClient
          .from('user_chart_access')
          .select('chart_id, can_view')
          .eq('user_id', parentUserId),
        adminClient
          .from('profiles')
          .select('full_name, email')
          .eq('id', parentUserId)
          .maybeSingle(),
      ])

    parentLabel =
      parentProfileRes.data?.full_name ||
      parentProfileRes.data?.email ||
      parentUserId

    const moduleInserts = (moduleAccessRes.data ?? []).map((row) => ({
      user_id: subuserId,
      module_id: row.module_id,
      enabled: row.enabled,
      display_order: row.display_order ?? 0,
    }))

    const tableInserts = (tableAccessRes.data ?? []).map((row) => ({
      user_id: subuserId,
      table_id: row.table_id,
      can_view: row.can_view,
    }))

    const chartInserts = (chartAccessRes.data ?? []).map((row) => ({
      user_id: subuserId,
      chart_id: row.chart_id,
      can_view: row.can_view,
    }))

    if (moduleInserts.length > 0) {
      await adminClient
        .from('user_module_access')
        .upsert(moduleInserts, { onConflict: 'user_id,module_id' })
    }
    if (tableInserts.length > 0) {
      await adminClient
        .from('user_table_access')
        .upsert(tableInserts, { onConflict: 'user_id,table_id' })
    }
    if (chartInserts.length > 0) {
      await adminClient
        .from('user_chart_access')
        .upsert(chartInserts, { onConflict: 'user_id,chart_id' })
    }
  } catch (err) {
    console.error('[v0] Subuser access clone error:', err)
  }

  return { ok: true, parentLabel }
}

/**
 * Create a subuser for a parent client and copy module/table/chart access.
 */
export async function createSubuserAction(
  _prev: CreateSubuserState | undefined,
  formData: FormData,
): Promise<CreateSubuserState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()
  const parentUserId = String(formData.get('parent_user_id') ?? '').trim()
  const isTechInspector = formData.get('is_tech_inspector') === 'true'

  if (isTechInspector) {
    return {
      ok: false,
      message:
        'Los inspectores se crean con el botón "Crear inspector de campo". No son subusuarios de un cliente.',
    }
  }

  if (!email || !password || !fullName || !parentUserId) {
    return { ok: false, message: 'Todos los campos son obligatorios.' }
  }
  if (password.length < 8) {
    return {
      ok: false,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    }
  }

  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden crear subusuarios.' }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      message:
        'Configuración del servidor incompleta. Falta SUPABASE_SERVICE_ROLE_KEY.',
    }
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

  if (createError || !created.user) {
    const msg = createError?.message ?? 'No se pudo crear el subusuario.'
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('exists')) {
      return { ok: false, message: 'Ya existe un usuario con ese email.' }
    }
    return { ok: false, message: msg }
  }

  const finalized = await finalizeSubuserAccount(adminClient, {
    subuserId: created.user.id,
    email,
    parentUserId,
    fullName,
  })

  if (!finalized.ok) {
    return {
      ok: false,
      message: `Subusuario creado, pero ${finalized.message}`,
    }
  }

  const { parentLabel } = finalized

  await logAudit(
    adminClient,
    {
      action_type: 'CREATE_SUBUSER',
      target_type: 'subuser',
      target_id: created.user.id,
      target_label: email,
      description: `Creó subusuario ${fullName} (${email}) para el cliente ${parentLabel}.`,
      metadata: {
        parent_user_id: parentUserId,
        parent_label: parentLabel,
      },
    },
    {
      actor_id: caller.id,
    },
  )

  revalidatePath('/admin')
  return {
    ok: true,
    message: `Subusuario creado para ${fullName} (${email}).`,
    userId: created.user.id,
  }
}

/**
 * Invites a subuser by email. They set name and password via /auth/registro.
 */
export async function inviteSubuserByEmailAction(
  _prev: CreateSubuserState | undefined,
  formData: FormData,
): Promise<CreateSubuserState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const parentUserId = String(formData.get('parent_user_id') ?? '').trim()

  if (!email || !parentUserId) {
    return { ok: false, message: 'El correo y el cliente principal son obligatorios.' }
  }

  const { supabase, caller, isAdmin, callerProfile } = await requireAdminCaller()
  if (!caller) return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  if (!isAdmin) return { ok: false, message: 'Solo administradores pueden invitar subusuarios.' }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, message: 'Configuración del servidor incompleta.' }
  }

  const { buildAuthCallbackUrl } = await import('@/lib/auth/site-url')
  const redirectTo = buildAuthCallbackUrl('/auth/registro')

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: invited, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    })

  if (inviteError || !invited.user) {
    const msg = inviteError?.message ?? 'No se pudo enviar la invitación.'
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('exists')) {
      return { ok: false, message: 'Ya existe un usuario con ese email.' }
    }
    return { ok: false, message: formatAuthEmailError(msg) }
  }

  const finalized = await finalizeSubuserAccount(adminClient, {
    subuserId: invited.user.id,
    email,
    parentUserId,
    fullName: null,
  })

  if (!finalized.ok) {
    return {
      ok: false,
      message: `Invitación enviada, pero ${finalized.message}`,
    }
  }

  const { parentLabel } = finalized
  const actorLabel =
    callerProfile?.full_name || callerProfile?.email || 'Admin'

  await logAudit(
    adminClient,
    {
      action_type: 'SEND_USER_INVITE',
      target_type: 'subuser',
      target_id: invited.user.id,
      target_label: email,
      description: `${actorLabel} invitó por correo al subusuario ${email} del cliente ${parentLabel}.`,
      metadata: { parent_user_id: parentUserId, parent_label: parentLabel, created: true },
    },
    {
      actor_id: caller.id,
      actor_email: callerProfile?.email ?? caller.email ?? null,
      actor_name: callerProfile?.full_name ?? null,
    },
  )

  revalidatePath('/admin')
  return {
    ok: true,
    message: `Enviamos un enlace a ${email} para que active su cuenta.`,
    userId: invited.user.id,
  }
}

export type SetTechInspectorState = {
  ok: boolean
  message: string
}

export type CreateFieldInspectorState = {
  ok: boolean
  message: string
}

export async function createFieldInspectorAction(
  _prev: CreateFieldInspectorState | undefined,
  formData: FormData,
): Promise<CreateFieldInspectorState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()

  if (!email || !password || !fullName) {
    return { ok: false, message: 'Todos los campos son obligatorios.' }
  }
  if (password.length < 8) {
    return { ok: false, message: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden crear inspectores.' }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, message: 'Configuración del servidor incompleta.' }
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    const msg = createError?.message ?? 'No se pudo crear el inspector.'
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('exists')) {
      return { ok: false, message: 'Ya existe un usuario con ese email.' }
    }
    return { ok: false, message: msg }
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      role: 'user',
      is_active: true,
      parent_user_id: null,
      is_tech_inspector: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', created.user.id)

  if (profileError) {
    return {
      ok: false,
      message: `Cuenta creada, pero falló el perfil de inspector: ${profileError.message}`,
    }
  }

  await syncInspectorModulesOnly(adminClient, created.user.id)

  await logAudit(
    adminClient,
    {
      action_type: 'CREATE_USER',
      target_type: 'user',
      target_id: created.user.id,
      target_label: email,
      description: `Creó inspector de campo ${fullName} (${email}).`,
      metadata: { is_tech_inspector: true },
    },
    { actor_id: caller.id },
  )

  revalidatePath('/admin')
  return {
    ok: true,
    message: `Inspector ${fullName} creado. Asigna los clientes donde puede trabajar.`,
  }
}

export async function getInspectorClientAssignmentsAction(
  inspectorId: string,
): Promise<{ ok: true; clientIds: string[] } | { ok: false; message: string }> {
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'No autorizado.' }
  }

  const { data, error } = await supabase
    .from('tech_assistance_inspector_clients')
    .select('client_user_id')
    .eq('inspector_id', inspectorId)

  if (error) return { ok: false, message: error.message }
  return { ok: true, clientIds: (data ?? []).map(r => r.client_user_id as string) }
}

export async function setInspectorClientAssignmentsAction(
  inspectorId: string,
  clientIds: string[],
): Promise<SetTechInspectorState> {
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'No autorizado.' }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, message: 'Configuración del servidor incompleta.' }
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: inspector } = await adminClient
    .from('profiles')
    .select('id, full_name, email, is_tech_inspector')
    .eq('id', inspectorId)
    .single()

  if (!inspector?.is_tech_inspector) {
    return { ok: false, message: 'El usuario no es inspector de campo.' }
  }

  const uniqueIds = [...new Set(clientIds.filter(Boolean))]

  if (uniqueIds.length > 0) {
    const { data: validClients } = await applyPrincipalClientFilters(
      adminClient.from('profiles').select('id').in('id', uniqueIds),
    )

    const validSet = new Set((validClients ?? []).map(c => c.id as string))
    const invalid = uniqueIds.filter(id => !validSet.has(id))
    if (invalid.length) {
      return { ok: false, message: 'Hay clientes no válidos en la selección.' }
    }
  }

  await adminClient
    .from('tech_assistance_inspector_clients')
    .delete()
    .eq('inspector_id', inspectorId)

  if (uniqueIds.length > 0) {
    await adminClient.from('tech_assistance_inspector_clients').insert(
      uniqueIds.map(clientId => ({
        inspector_id: inspectorId,
        client_user_id: clientId,
      })),
    )
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard/asistencia-tecnica')
  return {
    ok: true,
    message:
      uniqueIds.length > 0
        ? `Clientes asignados al inspector ${inspector.full_name || inspector.email}.`
        : 'Sin clientes asignados: el inspector verá todos los clientes con Asistencia técnica.',
  }
}

export async function setTechInspectorAction(
  userId: string,
  enabled: boolean,
): Promise<SetTechInspectorState> {
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return { ok: false, message: 'Sesión expirada.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden cambiar este rol.' }
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('id, parent_user_id, full_name, email, is_tech_inspector')
    .eq('id', userId)
    .single()

  if (!target) {
    return { ok: false, message: 'Usuario no encontrado.' }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, message: 'Configuración del servidor incompleta.' }
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const patch: Record<string, unknown> = {
    is_tech_inspector: enabled,
    updated_at: new Date().toISOString(),
  }

  if (enabled) {
    patch.parent_user_id = null
    if (target.parent_user_id) {
      await adminClient.from('tech_assistance_inspector_clients').upsert(
        {
          inspector_id: userId,
          client_user_id: target.parent_user_id,
        },
        { onConflict: 'inspector_id,client_user_id' },
      )
    }
  }

  const { error } = await adminClient.from('profiles').update(patch).eq('id', userId)

  if (error) {
    return { ok: false, message: error.message }
  }

  if (enabled) {
    await syncInspectorModulesOnly(adminClient, userId)
  }

  revalidatePath('/admin')
  return {
    ok: true,
    message: enabled
      ? 'Usuario marcado como inspector de campo.'
      : 'Rol de inspector de campo removido.',
  }
}

export async function resyncInspectorModulesAction(
  userId: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return { ok: false, message: 'Sesión expirada.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden sincronizar módulos.' }
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('id, is_tech_inspector, full_name, email')
    .eq('id', userId)
    .maybeSingle()

  if (!target?.is_tech_inspector) {
    return { ok: false, message: 'El usuario no es inspector de campo.' }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, message: 'Configuración del servidor incompleta.' }
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    await syncInspectorModulesOnly(adminClient, userId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al sincronizar módulos'
    return {
      ok: false,
      message: `${msg}. ¿Aplicaste la migración 075_inspector_phenology_module.sql en Supabase?`,
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return {
    ok: true,
    message: `Módulos sincronizados para ${target.full_name || target.email || 'inspector'}.`,
  }
}

/**
 * Update user's name and email.
 * Only admins can update other users.
 */
export async function updateUserAction(
  _prev: UpdateUserState | undefined,
  formData: FormData,
): Promise<UpdateUserState> {
  const userId = String(formData.get('user_id') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const fullName = String(formData.get('full_name') ?? '').trim()

  if (!userId || !email || !fullName) {
    return { ok: false, message: 'Todos los campos son obligatorios.' }
  }

  // 1. Verify the caller is an admin.
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden editar usuarios.' }
  }

  // 2. Use service-role client to update auth email and profile
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      message: 'Configuración del servidor incompleta. Falta SUPABASE_SERVICE_ROLE_KEY.',
    }
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Get current user data for comparison
  const { data: currentProfile } = await adminClient
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()

  const oldEmail = currentProfile?.email ?? ''
  const oldName = currentProfile?.full_name ?? ''

  // Update auth email if changed
  if (oldEmail !== email) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      userId,
      { email, email_confirm: true }
    )
    if (authError) {
      return { ok: false, message: `Error al actualizar email: ${authError.message}` }
    }
  }

  // Update profile
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileError) {
    return { ok: false, message: `Error al actualizar perfil: ${profileError.message}` }
  }

  // Audit log
  const { data: callerForLog } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', caller.id)
    .single()

  const actorLabel = callerForLog?.full_name || callerForLog?.email || 'Admin'
  const changes: string[] = []
  if (oldEmail !== email) changes.push(`email: ${oldEmail} → ${email}`)
  if (oldName !== fullName) changes.push(`nombre: ${oldName} → ${fullName}`)

  await logAudit(
    adminClient,
    {
      action_type: 'UPDATE_USER',
      target_type: 'user',
      target_id: userId,
      target_label: email,
      description: `${actorLabel} actualizó el usuario ${email}: ${changes.join(', ')}.`,
      metadata: { old_email: oldEmail, new_email: email, old_name: oldName, new_name: fullName },
    },
    {
      actor_id: caller.id,
      actor_email: callerForLog?.email ?? caller.email ?? null,
      actor_name: callerForLog?.full_name ?? null,
    },
  )

  revalidatePath('/admin')
  return {
    ok: true,
    message: `Usuario actualizado: ${fullName} (${email}).`,
  }
}

export type ResetPasswordState = {
  ok: boolean
  message: string
}

/**
 * Reset user password. Generates a temporary password and updates the user.
 * Only admins can reset other users' passwords.
 */
export async function resetPasswordAction(
  _prev: ResetPasswordState | undefined,
  formData: FormData,
): Promise<ResetPasswordState> {
  const userId = String(formData.get('user_id') ?? '').trim()
  const newPassword = String(formData.get('new_password') ?? '').trim()

  if (!userId || !newPassword) {
    return { ok: false, message: 'El usuario y la contraseña son obligatorios.' }
  }

  if (newPassword.length < 8) {
    return {
      ok: false,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    }
  }

  // 1. Verify the caller is an admin.
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden cambiar contraseñas.' }
  }

  // 2. Use service-role client to update password
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      message: 'Configuración del servidor incompleta. Falta SUPABASE_SERVICE_ROLE_KEY.',
    }
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Get user email for audit logging
  const { data: userProfile } = await adminClient
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()

  const userEmail = userProfile?.email ?? 'Usuario desconocido'

  // Update the password
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  )

  if (updateError) {
    return { ok: false, message: `Error al cambiar contraseña: ${updateError.message}` }
  }

  // Audit log
  const { data: callerForLog } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', caller.id)
    .single()

  const actorLabel = callerForLog?.full_name || callerForLog?.email || 'Admin'

  await logAudit(
    adminClient,
    {
      action_type: 'UPDATE_PASSWORD',
      target_type: 'user',
      target_id: userId,
      target_label: userEmail,
      description: `${actorLabel} cambió la contraseña del usuario ${userEmail}.`,
      metadata: { user_id: userId, user_email: userEmail },
    },
    {
      actor_id: caller.id,
      actor_email: callerForLog?.email ?? caller.email ?? null,
      actor_name: callerForLog?.full_name ?? null,
    },
  )

  revalidatePath('/admin')
  return {
    ok: true,
    message: `Contraseña actualizada para ${userEmail}.`,
  }
}

// ─── Avatar actions ────────────────────────────────────────────────────────────

export type AvatarActionState = { ok: boolean; message: string; url?: string }

async function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Update avatar_url for a user profile */
export async function updateAvatarAction(
  userId: string,
  avatarUrl: string | null,
): Promise<AvatarActionState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesion expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden cambiar avatares.' }

  const adminClient = await getAdminClient()
  const patch: Record<string, string | null> = { avatar_url: avatarUrl }
  if (avatarUrl && !avatarUrl.includes('/cropped/')) {
    patch.avatar_original_url = avatarUrl
  }
  const { error } = await adminClient.from('profiles').update(patch).eq('id', userId)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin')
  return { ok: true, message: 'Foto de perfil actualizada.' }
}

/** Upload an image file to the preset-avatars bucket */
export async function uploadPresetAvatarAction(formData: FormData): Promise<AvatarActionState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesion expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden subir imagenes.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false, message: 'No se selecciono ningun archivo.' }
  if (file.size > 2 * 1024 * 1024) return { ok: false, message: 'El archivo no puede superar 2 MB.' }
  if (!file.type.startsWith('image/')) return { ok: false, message: 'Solo se permiten imagenes.' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const adminClient = await getAdminClient()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await adminClient.storage.from('preset-avatars').upload(fileName, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return { ok: false, message: error.message }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/preset-avatars/${fileName}`
  return { ok: true, message: 'Imagen subida correctamente.', url: publicUrl }
}

/** Delete a preset image from the bucket */
export async function deletePresetAvatarAction(fileName: string): Promise<AvatarActionState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesion expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden eliminar imagenes.' }

  const adminClient = await getAdminClient()
  const { error } = await adminClient.storage.from('preset-avatars').remove([fileName])
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Imagen eliminada.' }
}

/** Upload a cropped avatar for a specific user (saved under cropped/ subfolder, not shown in gallery) */
export async function uploadCroppedAvatarAction(
  formData: FormData,
  userId: string,
): Promise<AvatarActionState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesion expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden cambiar avatares.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false, message: 'No se encontro el archivo.' }
  const originalUrl = String(formData.get('original_url') ?? '').trim() || null

  const ext = 'jpg'
  const fileName = `cropped/${userId}-${Date.now()}.${ext}`

  const adminClient = await getAdminClient()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await adminClient.storage.from('preset-avatars').upload(fileName, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) return { ok: false, message: error.message }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/preset-avatars/${fileName}`

  const profilePatch: Record<string, string> = { avatar_url: publicUrl }
  if (originalUrl && !originalUrl.includes('/cropped/')) {
    profilePatch.avatar_original_url = originalUrl
  }
  await adminClient.from('profiles').update(profilePatch).eq('id', userId)

  return { ok: true, message: 'Imagen recortada lista.', url: publicUrl }
}

// ─── Admin notifications ────────────────────────────────────────────────────────

export type NotificationState = { ok: boolean; message: string }

export interface AdminNotificationRow {
  id: string
  title: string
  message: string
  title_i18n?: LocalizedText | null
  message_i18n?: LocalizedText | null
  severity: 'info' | 'warning' | 'critical' | 'success'
  active_from: string
  active_until: string
  created_at: string
  target_role?: 'all' | 'admin' | 'user'
}

/** Create a new admin broadcast notification */
export async function createAdminNotificationAction(
  formData: FormData,
): Promise<NotificationState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden crear notificaciones.' }

  const titleEs     = String(formData.get('title_es') ?? formData.get('title') ?? '').trim()
  const titleEn     = String(formData.get('title_en') ?? '').trim()
  const messageEs   = String(formData.get('message_es') ?? formData.get('message') ?? '').trim()
  const messageEn   = String(formData.get('message_en') ?? '').trim()
  const severity    = String(formData.get('severity') ?? 'info')
  const activeFrom  = String(formData.get('active_from') ?? '')
  const activeUntil = String(formData.get('active_until') ?? '')

  if (!titleEs || !titleEn || !messageEs || !messageEn || !activeFrom || !activeUntil) {
    return { ok: false, message: 'Completa título y mensaje en español e inglés, y las fechas.' }
  }
  if (!['info', 'warning', 'critical', 'success'].includes(severity)) {
    return { ok: false, message: 'Severidad inválida.' }
  }
  if (new Date(activeUntil) <= new Date(activeFrom)) {
    return { ok: false, message: 'La fecha de fin debe ser posterior a la de inicio.' }
  }

  const targetRole = String(formData.get('target_role') ?? 'admin')
  if (!['all', 'admin', 'user'].includes(targetRole)) {
    return { ok: false, message: 'Rol de destino inválido.' }
  }

  const adminClient = await getAdminClient()
  const { error } = await insertAdminNotification(adminClient, {
    title: titleEs,
    message: messageEs,
    title_i18n: { es: titleEs, en: titleEn },
    message_i18n: { es: messageEs, en: messageEn },
    severity,
    active_from: new Date(activeFrom).toISOString(),
    active_until: new Date(activeUntil).toISOString(),
    created_by: caller.id,
    target_role: targetRole,
  })

  if (error) return { ok: false, message: error.message }

  await logAudit(supabase, {
    action_type: 'CREATE_ADMIN_NOTIFICATION',
    target_type: 'admin_notification',
    target_label: titleEs,
    description: `Creó notificación "${titleEs}" (${severity}, destino: ${targetRole})`,
    metadata: { severity, target_role: targetRole, active_from: activeFrom, active_until: activeUntil },
  }, { actor_id: caller.id })

  revalidatePath('/admin')
  return { ok: true, message: 'Notificación creada correctamente.' }
}

/** Delete an admin notification */
export async function deleteAdminNotificationAction(
  id: string,
): Promise<NotificationState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden eliminar notificaciones.' }

  const adminClient = await getAdminClient()
  const { data: existing } = await adminClient
    .from('admin_notifications')
    .select('title')
    .eq('id', id)
    .maybeSingle()

  const { error } = await adminClient.from('admin_notifications').delete().eq('id', id)

  if (error) return { ok: false, message: error.message }

  await logAudit(supabase, {
    action_type: 'DELETE_ADMIN_NOTIFICATION',
    target_type: 'admin_notification',
    target_id: id,
    target_label: existing?.title ?? id,
    description: `Eliminó notificación "${existing?.title ?? id}"`,
  }, { actor_id: caller.id })

  revalidatePath('/admin')
  return { ok: true, message: 'Notificación eliminada.' }
}

/** List all admin notifications (for admin panel) */
export async function listAdminNotificationsAction(): Promise<AdminNotificationRow[]> {
  try {
    const adminClient = await getAdminClient()
    const { data, error } = await listAdminNotifications(adminClient)
    if (error || !data) return []
    return data as AdminNotificationRow[]
  } catch {
    return []
  }
}

/** Update an existing admin notification */
export async function updateAdminNotificationAction(
  id: string,
  formData: FormData,
): Promise<NotificationState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden editar notificaciones.' }

  const titleEs     = String(formData.get('title_es') ?? formData.get('title') ?? '').trim()
  const titleEn     = String(formData.get('title_en') ?? '').trim()
  const messageEs   = String(formData.get('message_es') ?? formData.get('message') ?? '').trim()
  const messageEn   = String(formData.get('message_en') ?? '').trim()
  const severity    = String(formData.get('severity') ?? 'info')
  const activeFrom  = String(formData.get('active_from') ?? '')
  const activeUntil = String(formData.get('active_until') ?? '')
  const targetRole  = String(formData.get('target_role') ?? 'admin')

  if (!titleEs || !titleEn || !messageEs || !messageEn || !activeFrom || !activeUntil) {
    return { ok: false, message: 'Completa título y mensaje en español e inglés, y las fechas.' }
  }
  if (!['info', 'warning', 'critical', 'success'].includes(severity)) {
    return { ok: false, message: 'Severidad inválida.' }
  }
  if (!['all', 'admin', 'user'].includes(targetRole)) {
    return { ok: false, message: 'Rol de destino inválido.' }
  }
  if (new Date(activeUntil) <= new Date(activeFrom)) {
    return { ok: false, message: 'La fecha de fin debe ser posterior a la de inicio.' }
  }

  const adminClient = await getAdminClient()
  const { error } = await updateAdminNotification(adminClient, id, {
    title: titleEs,
    message: messageEs,
    title_i18n: { es: titleEs, en: titleEn },
    message_i18n: { es: messageEs, en: messageEn },
    severity,
    active_from: new Date(activeFrom).toISOString(),
    active_until: new Date(activeUntil).toISOString(),
    target_role: targetRole,
  })

  if (error) return { ok: false, message: error.message }

  await logAudit(supabase, {
    action_type: 'UPDATE_ADMIN_NOTIFICATION',
    target_type: 'admin_notification',
    target_id: id,
    target_label: titleEs,
    description: `Actualizó notificación "${titleEs}" (${severity}, destino: ${targetRole})`,
    metadata: { severity, target_role: targetRole },
  }, { actor_id: caller.id })

  revalidatePath('/admin')
  return { ok: true, message: 'Notificación actualizada.' }
}

// ─── Blocked IPs ──────────────────────────────────────────────────────────────

export interface BlockedIpRow {
  id: string
  ip_address: string
  reason: string | null
  blocked_by: string | null
  created_at: string
}

export async function listBlockedIpsAction(): Promise<BlockedIpRow[]> {
  try {
    const adminClient = await getAdminClient()
    const { data, error } = await adminClient
      .from('blocked_ips')
      .select('id, ip_address, reason, blocked_by, created_at')
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data as BlockedIpRow[]
  } catch {
    return []
  }
}

export async function blockIpAction(ip: string, reason?: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role, email').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden bloquear IPs.' }

  if (!ip?.trim()) return { ok: false, message: 'IP inválida.' }

  const adminClient = await getAdminClient()
  const callerEmail = callerProfile.email ?? caller.email ?? null
  if (await isAdminOwnIp(adminClient, callerEmail, ip.trim())) {
    return { ok: false, message: 'No puedes bloquear tu propia IP. Perderías acceso al panel.' }
  }

  const { error } = await adminClient.from('blocked_ips').upsert({
    ip_address: ip.trim(),
    reason:     reason?.trim() || null,
    blocked_by: caller.id,
    created_at: new Date().toISOString(),
  }, { onConflict: 'ip_address' })

  if (error) return { ok: false, message: error.message }

  await logAudit(supabase, {
    action_type: 'BLOCK_IP',
    target_type: 'ip',
    target_id:   ip,
    target_label: ip,
    description: `Bloqueó manualmente la IP ${ip}${reason ? ` — ${reason}` : ''}`,
    metadata: { ip, reason, timestamp: new Date().toISOString() },
  })

  return { ok: true, message: `IP ${ip} bloqueada.` }
}

export async function unblockIpAction(ip: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden desbloquear IPs.' }

  const adminClient = await getAdminClient()
  const { error } = await adminClient.from('blocked_ips').delete().eq('ip_address', ip.trim())

  if (error) return { ok: false, message: error.message }

  await logAudit(supabase, {
    action_type: 'UNBLOCK_IP',
    target_type: 'ip',
    target_id:   ip,
    target_label: ip,
    description: `Desbloqueó la IP ${ip}`,
    metadata: { ip, timestamp: new Date().toISOString() },
  })

  return { ok: true, message: `IP ${ip} desbloqueada.` }
}

/** List all preset avatar images */
export async function listPresetAvatarsAction(): Promise<{ name: string; url: string }[]> {
  try {
    const adminClient = await getAdminClient()
    const { data, error } = await adminClient.storage.from('preset-avatars').list('', {
      limit: 200,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error || !data) return []
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    return data
      .filter(f => f.name !== '.emptyFolderPlaceholder')
      .map(f => ({
        name: f.name,
        url: `${supabaseUrl}/storage/v1/object/public/preset-avatars/${f.name}`,
      }))
  } catch {
    return []
  }
}

// ─── Database Backups ──────────────────────────────────────────────────────────

export type BackupState = { ok: boolean; message: string }

const BACKUP_BUCKET = 'db-backups'
const BACKUP_VERSION = '1.1'

/** Tables to include in backups, in dependency order for safe upsert restore */
const BACKUP_TABLES = [
  'profiles',
  'modules',
  'user_module_access',
  'dynamic_tables',
  'dynamic_table_rows',
  'dynamic_charts',
  'inventory_warehouses',
  'inventory_materials',
  'inventory_movements',
  'inventory_min_levels',
  'admin_notifications',
  'module_links',
  'carpetas',
  'documentos',
  'shared_links',
  'harvest_estimates',
  'harvest_fields',
  'harvest_blocks',
  'phenology_stages',
  'phenology_observations',
] as const

type BackupTable = typeof BACKUP_TABLES[number]

export interface BackupMeta {
  fileName: string
  createdAt: string
  sizeBytes: number
  label: string
}

export interface BackupSnapshot {
  version: string
  created_at: string
  label: string
  tables: Partial<Record<BackupTable, unknown[]>>
  row_counts: Partial<Record<BackupTable, number>>
  storage_manifest?: {
    boveda: Array<{ path: string; size: number; user_id: string }>
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureBackupBucket(admin: any) {
  try {
    await admin.storage.createBucket(BACKUP_BUCKET, {
      public: false,
      fileSizeLimit: 100 * 1024 * 1024, // 100 MB
    })
  } catch {
    // Bucket likely already exists — safe to ignore
  }
}

/** Create a full database snapshot and store it in Supabase Storage */
export async function createBackupAction(label?: string): Promise<BackupState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden crear backups.' }

  const adminClient = await getAdminClient()
  await ensureBackupBucket(adminClient)

  const snapshot: BackupSnapshot = {
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    label: label?.trim() || `Backup automático ${new Date().toLocaleString('es-CL')}`,
    tables: {},
    row_counts: {},
  }

  // Fetch each table with a generous row limit
  for (const table of BACKUP_TABLES) {
    try {
      const { data, error } = await adminClient
        .from(table)
        .select('*')
        .limit(50000)

      if (!error && data) {
        snapshot.tables[table] = data
        snapshot.row_counts[table] = data.length
      } else {
        snapshot.tables[table] = []
        snapshot.row_counts[table] = 0
      }
    } catch {
      snapshot.tables[table] = []
      snapshot.row_counts[table] = 0
    }
  }

  // Manifest of boveda storage paths (binaries remain in Storage bucket)
  const docs = (snapshot.tables.documentos ?? []) as Array<{ storage_path?: string; size?: number; user_id?: string }>
  snapshot.storage_manifest = {
    boveda: docs
      .filter(d => d.storage_path && d.user_id)
      .map(d => ({
        path: d.storage_path as string,
        size: d.size ?? 0,
        user_id: d.user_id as string,
      })),
  }

  const json    = JSON.stringify(snapshot, null, 2)
  const buffer  = Buffer.from(json, 'utf-8')
  const now     = new Date()
  const pad     = (n: number) => String(n).padStart(2, '0')
  const stamp   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const fileName = `backup_${stamp}.json`

  const { error: uploadError } = await adminClient.storage
    .from(BACKUP_BUCKET)
    .upload(fileName, buffer, { contentType: 'application/json', upsert: false })

  if (uploadError) return { ok: false, message: `Error al guardar backup: ${uploadError.message}` }

  const totalRows = Object.values(snapshot.row_counts).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0

  await logAudit(supabase, {
    action_type: 'CREATE_BACKUP',
    target_type: 'backup',
    target_label: fileName,
    description: `Creó backup ${fileName} (${totalRows.toLocaleString('es-CL')} filas)`,
    metadata: {
      file_name: fileName,
      label: snapshot.label,
      row_counts: snapshot.row_counts,
      total_rows: totalRows,
    },
  }, {
    actor_id: caller.id,
  })

  revalidatePath('/admin')
  return { ok: true, message: `Backup creado: ${fileName} (${totalRows.toLocaleString('es-CL')} filas)` }
}

/** List all available backups ordered by date descending */
export async function listBackupsAction(): Promise<BackupMeta[]> {
  try {
    const adminClient = await getAdminClient()
    await ensureBackupBucket(adminClient)

    const { data, error } = await adminClient.storage
      .from(BACKUP_BUCKET)
      .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })

    if (error || !data) return []

    return data
      .filter(f => f.name.endsWith('.json') && f.name !== '.emptyFolderPlaceholder')
      .map(f => {
        // Parse timestamp from filename: backup_YYYY-MM-DD_HH-MM-SS.json
        const match = f.name.match(/backup_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/)
        let createdAt = f.created_at ?? new Date().toISOString()
        if (match) {
          const [, date, time] = match
          createdAt = `${date}T${time.replace(/-/g, ':')}:00.000Z`
        }
        return {
          fileName:  f.name,
          createdAt,
          sizeBytes: f.metadata?.size ?? 0,
          label:     f.name.replace('.json', '').replace(/_/g, ' '),
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

/** Download a backup file and return it as base64 for client-side download */
export async function downloadBackupAction(fileName: string): Promise<{ ok: boolean; data?: string; message?: string }> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Sin permisos.' }

  const adminClient = await getAdminClient()
  const { data, error } = await adminClient.storage.from(BACKUP_BUCKET).download(fileName)
  if (error || !data) return { ok: false, message: error?.message ?? 'Archivo no encontrado.' }

  const text = await data.text()
  return { ok: true, data: text }
}

/** Restore database from a backup snapshot (upsert strategy — safe, no data loss for new rows) */
export async function restoreBackupAction(fileName: string): Promise<BackupState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role, full_name, email').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Solo administradores pueden restaurar backups.' }

  const adminClient = await getAdminClient()

  // Download the backup file
  const { data: fileData, error: downloadError } = await adminClient.storage
    .from(BACKUP_BUCKET)
    .download(fileName)
  if (downloadError || !fileData) return { ok: false, message: 'No se pudo descargar el backup.' }

  let snapshot: BackupSnapshot
  try {
    const text = await fileData.text()
    snapshot = JSON.parse(text) as BackupSnapshot
  } catch {
    return { ok: false, message: 'El archivo de backup está corrupto o en formato inválido.' }
  }

  if (!snapshot.tables) return { ok: false, message: 'El backup no contiene datos de tablas.' }

  const errors: string[] = []
  let restoredRows = 0

  // Upsert in dependency order (same as BACKUP_TABLES)
  const UPSERT_CONFLICT: Partial<Record<BackupTable, string>> = {
    profiles:             'id',
    modules:              'id',
    user_module_access:   'user_id,module_id',
    dynamic_tables:       'id',
    dynamic_table_rows:   'id',
    dynamic_charts:       'id',
    inventory_warehouses: 'id',
    inventory_materials:  'id',
    inventory_movements:  'id',
    inventory_min_levels: 'id',
    admin_notifications:  'id',
    module_links:         'id',
    carpetas:             'id',
    documentos:           'id',
    shared_links:         'id',
  }

  for (const table of BACKUP_TABLES) {
    const rows = snapshot.tables[table]
    if (!rows || rows.length === 0) continue

    const conflict = UPSERT_CONFLICT[table] ?? 'id'
    const CHUNK = 500

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { error } = await adminClient
        .from(table)
        .upsert(chunk as Record<string, unknown>[], { onConflict: conflict })

      if (error) {
        errors.push(`${table}: ${error.message}`)
      } else {
        restoredRows += chunk.length
      }
    }
  }

  // Audit log (use the server client which has the correct session for logAudit)
  await logAudit(
    supabase,
    {
      action_type: 'RESTORE_BACKUP',
      description: `Restauración de backup: ${fileName} (${restoredRows} filas restauradas)${errors.length ? ` — ${errors.length} errores` : ''}`,
      target_type: 'backup',
      target_id: fileName,
      target_label: fileName,
      metadata: { restored_rows: restoredRows, errors: errors.slice(0, 10) },
    },
    {
      actor_id: caller.id,
      actor_email: callerProfile?.email ?? caller.email ?? null,
      actor_name: callerProfile?.full_name ?? null,
    },
  )

  if (errors.length > 0) {
    return {
      ok: true,
      message: `Restauración completada con advertencias: ${restoredRows} filas restauradas. Errores: ${errors.slice(0, 3).join('; ')}`,
    }
  }

  revalidatePath('/admin')
  return { ok: true, message: `Backup restaurado correctamente: ${restoredRows.toLocaleString('es-CL')} filas actualizadas.` }
}

// ─── Vault admin (bóveda documental) ───────────────────────────────────────────

export interface VaultClientSummary {
  id: string
  full_name: string | null
  email: string | null
  file_count: number
  folder_count: number
  total_bytes: number
  active_shares: number
  storage_quota_gb: number
  storage_quota_bytes: number | null
  storage_plan_id: string
  service_plan_id: ServicePlanId | null
  quota_bytes: number
}

export interface VaultFolderRow {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

export interface VaultDocumentRow {
  id: string
  name: string
  size: number
  type: string
  folder_id: string | null
  storage_path: string
  created_at: string
  expires_at: string | null
}

export interface VaultSharedLinkRow {
  id: string
  code: string
  file_name: string
  storage_path: string
  expires_at: string
  created_at: string
  user_id: string
  creator_name: string | null
  creator_email: string | null
  is_expired: boolean
  client_name: string | null
}

export interface VaultExplorerData {
  folders: VaultFolderRow[]
  documents: VaultDocumentRow[]
  client: { id: string; full_name: string | null; email: string | null }
}

type VaultActionState = { ok: boolean; message: string }

async function requireAdminVaultCaller() {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', caller.id)
    .single()

  if (profile?.role !== 'admin') return null

  const adminClient = await getAdminClient()
  return { supabase, adminClient, caller, profile }
}

async function getVaultOwnerIds(
  adminClient: Awaited<ReturnType<typeof getAdminClient>>,
  principalUserId: string,
): Promise<string[]> {
  const { data: subs } = await adminClient
    .from('profiles')
    .select('id')
    .eq('parent_user_id', principalUserId)

  return [principalUserId, ...(subs?.map(s => s.id as string) ?? [])]
}

function normalizeVaultFolderId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function mapVaultDocument(row: Record<string, unknown>): VaultDocumentRow {
  return {
    id: row.id as string,
    name: row.name as string,
    size: Number(row.size) || 0,
    type: String(row.type ?? 'pdf'),
    folder_id: normalizeVaultFolderId(row.folder_id),
    storage_path: String(row.storage_path ?? ''),
    created_at: String(row.created_at ?? ''),
    expires_at: row.expires_at != null ? String(row.expires_at) : null,
  }
}

function mapVaultFolder(row: Record<string, unknown>): VaultFolderRow {
  return {
    id: row.id as string,
    name: row.name as string,
    parent_id: normalizeVaultFolderId(row.parent_id),
    created_at: String(row.created_at ?? ''),
  }
}

export async function getVaultClientsSummaryAction(): Promise<VaultClientSummary[]> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return []

  const { adminClient } = ctx

  const [clientsRes, docsRes, phenologyRes, foldersRes, linksRes, userProfilesRes] = await Promise.all([
    applyPrincipalClientFilters(
      adminClient
        .from('profiles')
        .select('id, full_name, email, storage_quota_gb, storage_quota_bytes, service_plan_id'),
    ).order('full_name', { ascending: true }),
    adminClient.from('documentos').select('user_id, size'),
    adminClient.from('phenology_observation_images').select('user_id, file_size'),
    adminClient.from('carpetas').select('user_id'),
    adminClient.from('shared_links').select('user_id, expires_at'),
    adminClient.from('profiles').select('id, parent_user_id').eq('role', 'user'),
  ])

  const principalIds = new Set((clientsRes.data ?? []).map(c => c.id as string))
  const ownerOf = (uid: string): string => {
    const profile = (userProfilesRes.data ?? []).find(p => p.id === uid)
    const parent = profile?.parent_user_id as string | null | undefined
    if (parent && principalIds.has(parent)) return parent
    return uid
  }

  const stats = new Map<string, { files: number; folders: number; bytes: number; shares: number }>()
  const ensure = (id: string) => {
    if (!stats.has(id)) stats.set(id, { files: 0, folders: 0, bytes: 0, shares: 0 })
    return stats.get(id)!
  }

  for (const row of docsRes.data ?? []) {
    const ownerId = ownerOf(row.user_id as string)
    if (!principalIds.has(ownerId)) continue
    const s = ensure(ownerId)
    s.files += 1
    s.bytes += Number(row.size) || 0
  }
  for (const row of phenologyRes.data ?? []) {
    const ownerId = ownerOf(row.user_id as string)
    if (!principalIds.has(ownerId)) continue
    const s = ensure(ownerId)
    s.files += 1
    s.bytes += Number(row.file_size) || 0
  }
  for (const row of foldersRes.data ?? []) {
    const ownerId = ownerOf(row.user_id as string)
    if (!principalIds.has(ownerId)) continue
    ensure(ownerId).folders += 1
  }
  const now = Date.now()
  for (const row of linksRes.data ?? []) {
    if (new Date(row.expires_at as string).getTime() > now) {
      const ownerId = ownerOf(row.user_id as string)
      if (!principalIds.has(ownerId)) continue
      ensure(ownerId).shares += 1
    }
  }

  return (clientsRes.data ?? []).map(c => {
    const s = stats.get(c.id) ?? { files: 0, folders: 0, bytes: 0, shares: 0 }
    const storageQuotaBytes = c.storage_quota_bytes != null ? Number(c.storage_quota_bytes) : null
    const storageQuotaGb = Number(c.storage_quota_gb) || DEFAULT_STORAGE_QUOTA_GB
    const quotaBytes = resolveStorageQuotaBytes({
      storage_quota_bytes: storageQuotaBytes,
      storage_quota_gb: storageQuotaGb,
    })
    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      file_count: s.files,
      folder_count: s.folders,
      total_bytes: s.bytes,
      active_shares: s.shares,
      storage_quota_gb: storageQuotaGb,
      storage_quota_bytes: storageQuotaBytes,
      storage_plan_id: resolveStoragePlanId({
        storage_quota_bytes: storageQuotaBytes,
        storage_quota_gb: storageQuotaGb,
      }),
      service_plan_id: isServicePlanId(c.service_plan_id as string | null)
        ? (c.service_plan_id as ServicePlanId)
        : null,
      quota_bytes: quotaBytes,
    }
  })
}

export async function updateClientStorageQuotaAction(
  userId: string,
  planId: string,
): Promise<VaultActionState> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return { ok: false, message: 'No autorizado.' }

  if (!isStoragePlanId(planId)) {
    return { ok: false, message: 'Plan de almacenamiento no válido.' }
  }

  const plan = getStoragePlanById(planId)!
  const { adminClient, supabase, caller, profile } = ctx

  const { data: client, error: clientError } = await adminClient
    .from('profiles')
    .select('id, full_name, email, role, parent_user_id, storage_quota_gb, storage_quota_bytes, is_tech_inspector')
    .eq('id', userId)
    .maybeSingle()

  if (clientError || !client) {
    return { ok: false, message: 'Cliente no encontrado.' }
  }
  if (!isPrincipalClientProfile(client)) {
    return { ok: false, message: 'Solo se puede asignar cuota a clientes principales.' }
  }

  const updatePayload = {
    storage_quota_bytes: plan.quotaBytes,
    storage_quota_gb:
      planId === '1mb-test'
        ? DEFAULT_STORAGE_QUOTA_GB
        : Math.round(plan.quotaBytes / (1024 * 1024 * 1024)),
  }

  const { data: updated, error } = await adminClient
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select('storage_quota_gb, storage_quota_bytes')
    .single()

  if (error || !updated) {
    const msg = error?.message ?? ''
    if (msg.includes('storage_quota_bytes')) {
      return {
        ok: false,
        message: 'Falta la migración de almacenamiento. Ejecuta 023 y 024 en Supabase SQL Editor.',
      }
    }
    return { ok: false, message: error?.message || 'No se pudo actualizar la cuota.' }
  }

  await logAudit(
    supabase,
    {
      action_type: 'UPDATE_PERMISSION',
      target_type: 'user',
      target_id: userId,
      target_label: client.full_name || client.email || userId,
      description: `Asignó plan de almacenamiento "${plan.label}" a ${client.full_name || client.email || userId}.`,
      metadata: {
        storage_plan_id: planId,
        storage_quota_bytes: updatePayload.storage_quota_bytes,
        storage_quota_gb: updatePayload.storage_quota_gb,
        previous_storage_quota_gb: client.storage_quota_gb,
        previous_storage_quota_bytes: client.storage_quota_bytes,
        admin_id: caller.id,
        admin_email: profile.email,
      },
    },
    { actor_id: caller.id },
  )

  revalidatePath('/admin')
  return { ok: true, message: `Plan de almacenamiento actualizado a ${plan.label}.` }
}

export async function updateClientServicePlanAction(
  userId: string,
  planId: ServicePlanId | null,
): Promise<VaultActionState> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return { ok: false, message: 'No autorizado.' }

  if (planId !== null && !isServicePlanId(planId)) {
    return { ok: false, message: 'Plan de servicio no válido.' }
  }

  const { adminClient, supabase, caller, profile } = ctx

  const { data: client, error: clientError } = await adminClient
    .from('profiles')
    .select('id, full_name, email, role, parent_user_id, service_plan_id, is_tech_inspector')
    .eq('id', userId)
    .maybeSingle()

  if (clientError || !client) {
    return { ok: false, message: 'Cliente no encontrado.' }
  }
  if (!isPrincipalClientProfile(client)) {
    return { ok: false, message: 'Solo se puede asignar plan a clientes principales.' }
  }

  const now = new Date()
  const planDates = planId
    ? {
        service_plan_activated_at: now.toISOString(),
        service_plan_expires_at: computeServicePlanExpiresAt(now).toISOString(),
      }
    : {
        service_plan_activated_at: null,
        service_plan_expires_at: null,
      }

  const { error } = await adminClient
    .from('profiles')
    .update({ service_plan_id: planId, ...planDates })
    .eq('id', userId)

  if (error) {
    if (isMissingServicePlanDateColumns(error.message)) {
      const { error: fallbackError } = await adminClient
        .from('profiles')
        .update({ service_plan_id: planId })
        .eq('id', userId)

      if (fallbackError) {
        return { ok: false, message: fallbackError.message || 'No se pudo actualizar el plan.' }
      }
    } else if (error.message.includes('service_plan_id')) {
      return {
        ok: false,
        message: 'Falta la migración de planes. Ejecuta 052_profiles_service_plan.sql en Supabase.',
      }
    } else {
      return { ok: false, message: error.message || 'No se pudo actualizar el plan.' }
    }
  }

  const planLabel = planId ?? 'Sin plan'

  await logAudit(
    supabase,
    {
      action_type: 'UPDATE_PERMISSION',
      target_type: 'user',
      target_id: userId,
      target_label: client.full_name || client.email || userId,
      description: `Asignó plan de servicio "${planLabel}" a ${client.full_name || client.email || userId}.`,
      metadata: {
        service_plan_id: planId,
        previous_service_plan_id: client.service_plan_id,
        service_plan_activated_at: planDates.service_plan_activated_at,
        service_plan_expires_at: planDates.service_plan_expires_at,
        admin_id: caller.id,
        admin_email: profile.email,
      },
    },
    { actor_id: caller.id },
  )

  revalidatePath('/admin')
  revalidatePath('/admin/planes-servicio')
  revalidatePath('/dashboard/perfil')
  return { ok: true, message: `Plan de servicio actualizado.` }
}

export interface ClientServicePlanRow {
  id: string
  full_name: string | null
  email: string | null
  service_plan_id: ServicePlanId
  service_plan_activated_at: string | null
  service_plan_expires_at: string | null
  is_active: boolean
  status: ServicePlanSubscriptionStatus
  daysUntilExpiry: number | null
}

export async function listClientServicePlansAction(): Promise<ClientServicePlanRow[]> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return []

  const { adminClient } = ctx
  const { data, error } = await adminClient
    .from('profiles')
    .select(
      'id, full_name, email, role, parent_user_id, service_plan_id, service_plan_activated_at, service_plan_expires_at, is_active, is_tech_inspector',
    )
    .not('service_plan_id', 'is', null)
    .order('service_plan_expires_at', { ascending: true, nullsFirst: false })

  if (error) {
    if (isMissingServicePlanDateColumns(error.message)) {
      const fallback = await adminClient
        .from('profiles')
        .select('id, full_name, email, role, parent_user_id, service_plan_id, is_active, is_tech_inspector')
        .not('service_plan_id', 'is', null)
      if (fallback.error) return []
      return (fallback.data ?? [])
        .filter(row => isPrincipalClientProfile(row) && isServicePlanId(row.service_plan_id))
        .map(row => {
          const info = buildServicePlanSubscriptionInfo(row.service_plan_id, null, null)
          return {
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            service_plan_id: row.service_plan_id as ServicePlanId,
            service_plan_activated_at: null,
            service_plan_expires_at: null,
            is_active: row.is_active !== false,
            status: info.status,
            daysUntilExpiry: info.daysUntilExpiry,
          }
        })
    }
    return []
  }

  return (data ?? [])
    .filter(row => isPrincipalClientProfile(row) && isServicePlanId(row.service_plan_id))
    .map(row => {
      const planId = row.service_plan_id as ServicePlanId
      const info = buildServicePlanSubscriptionInfo(
        planId,
        row.service_plan_activated_at,
        row.service_plan_expires_at,
      )
      return {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        service_plan_id: planId,
        service_plan_activated_at: row.service_plan_activated_at,
        service_plan_expires_at: row.service_plan_expires_at,
        is_active: row.is_active !== false,
        status: info.status,
        daysUntilExpiry: info.daysUntilExpiry,
      }
    })
}

export async function blockClientAccountAction(userId: string): Promise<VaultActionState> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return { ok: false, message: 'No autorizado.' }

  const { adminClient, supabase, caller, profile } = ctx

  const { data: client, error: clientError } = await adminClient
    .from('profiles')
    .select('id, full_name, email, role, parent_user_id, is_active, is_tech_inspector')
    .eq('id', userId)
    .maybeSingle()

  if (clientError || !client) {
    return { ok: false, message: 'Cliente no encontrado.' }
  }
  if (!isPrincipalClientProfile(client)) {
    return { ok: false, message: 'Solo se pueden bloquear clientes principales.' }
  }
  if (client.is_active === false) {
    return { ok: false, message: 'El usuario ya está bloqueado.' }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    return { ok: false, message: error.message || 'No se pudo bloquear al usuario.' }
  }

  const userLabel = client.full_name || client.email || userId
  await logAudit(
    supabase,
    {
      action_type: 'BLOCK_USER',
      target_type: 'user',
      target_id: userId,
      target_label: client.email ?? userLabel,
      description: `Bloqueó la cuenta de ${userLabel} por plan de servicio vencido.`,
      metadata: {
        previous_state: { user_id: userId, is_active: true },
        reason: 'service_plan_expired',
        admin_id: caller.id,
        admin_email: profile.email,
      },
    },
    { actor_id: caller.id },
  )

  revalidatePath('/admin')
  revalidatePath('/admin/planes-servicio')
  return { ok: true, message: `${userLabel} fue bloqueado.` }
}

export async function getVaultClientExplorerAction(userId: string): Promise<VaultExplorerData | null> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx || !userId) return null

  const { adminClient } = ctx
  const ownerIds = await getVaultOwnerIds(adminClient, userId)

  const [clientRes, foldersRes, docsRes] = await Promise.all([
    adminClient.from('profiles').select('id, full_name, email').eq('id', userId).single(),
    adminClient
      .from('carpetas')
      .select('id, name, parent_id, created_at')
      .in('user_id', ownerIds)
      .order('name'),
    adminClient
      .from('documentos')
      .select('*')
      .in('user_id', ownerIds)
      .order('created_at', { ascending: false }),
  ])

  if (clientRes.error || !clientRes.data) return null

  if (docsRes.error) {
    console.error('[vault-admin] documentos query failed:', docsRes.error.message)
  }
  if (foldersRes.error) {
    console.error('[vault-admin] carpetas query failed:', foldersRes.error.message)
  }

  return {
    client: clientRes.data,
    folders: (foldersRes.data ?? []).map(row => mapVaultFolder(row as Record<string, unknown>)),
    documents: (docsRes.data ?? []).map(row => mapVaultDocument(row as Record<string, unknown>)),
  }
}

export async function getVaultSharedLinksAction(userId?: string): Promise<VaultSharedLinkRow[]> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return []

  const { adminClient } = ctx

  let query = adminClient
    .from('shared_links')
    .select('id, code, file_name, storage_path, expires_at, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(500)

  if (userId) query = query.eq('user_id', userId)

  const { data: links, error } = await query
  if (error || !links) return []

  const userIds = [...new Set(links.map(l => l.user_id).filter(Boolean) as string[])]
  const { data: profiles } = userIds.length
    ? await adminClient.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const now = Date.now()

  return links.map(link => {
    const creator = profileMap.get(link.user_id as string)
    const isExpired = new Date(link.expires_at as string).getTime() <= now
    return {
      id: link.id as string,
      code: link.code as string,
      file_name: link.file_name as string,
      storage_path: link.storage_path as string,
      expires_at: link.expires_at as string,
      created_at: link.created_at as string,
      user_id: link.user_id as string,
      creator_name: creator?.full_name ?? null,
      creator_email: creator?.email ?? null,
      client_name: creator?.full_name ?? creator?.email ?? null,
      is_expired: isExpired,
    }
  })
}

export async function revokeVaultSharedLinkAction(linkId: string): Promise<VaultActionState> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return { ok: false, message: 'Sin permisos.' }

  const { supabase, adminClient, caller, profile } = ctx

  const { data: link } = await adminClient
    .from('shared_links')
    .select('id, file_name, code, user_id')
    .eq('id', linkId)
    .single()

  if (!link) return { ok: false, message: 'Link no encontrado.' }

  const { error } = await adminClient.from('shared_links').delete().eq('id', linkId)
  if (error) return { ok: false, message: error.message }

  await logAudit(
    supabase,
    {
      action_type: 'SYSTEM',
      description: `Admin revocó link compartido de "${link.file_name}" (código ${link.code})`,
      target_type: 'shared_link',
      target_id: linkId,
      target_label: link.file_name as string,
    },
    {
      actor_id: caller.id,
      actor_email: profile?.email ?? caller.email ?? null,
      actor_name: profile?.full_name ?? null,
      actor_kind: 'admin',
    },
  )

  revalidatePath('/admin')
  return { ok: true, message: 'Link revocado correctamente.' }
}

export async function getVaultFileDownloadUrlAction(documentId: string): Promise<{ ok: boolean; url?: string; message?: string }> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return { ok: false, message: 'Sin permisos.' }

  const { adminClient } = ctx

  const { data: doc } = await adminClient
    .from('documentos')
    .select('storage_path, name')
    .eq('id', documentId)
    .single()

  if (!doc?.storage_path) return { ok: false, message: 'Archivo no encontrado.' }

  const { data, error } = await adminClient.storage
    .from('boveda')
    .createSignedUrl(doc.storage_path as string, 3600, { download: doc.name as string })

  if (error || !data?.signedUrl) return { ok: false, message: error?.message ?? 'No se pudo generar URL.' }
  return { ok: true, url: data.signedUrl }
}

export async function adminDeleteVaultDocumentAction(documentId: string): Promise<VaultActionState> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return { ok: false, message: 'Sin permisos.' }

  const { supabase, adminClient, caller, profile } = ctx

  const { data: doc } = await adminClient
    .from('documentos')
    .select('id, name, storage_path, user_id')
    .eq('id', documentId)
    .single()

  if (!doc) return { ok: false, message: 'Archivo no encontrado.' }

  if (doc.storage_path) {
    await adminClient.storage.from('boveda').remove([doc.storage_path as string])
  }

  await adminClient.from('shared_links').delete().eq('storage_path', doc.storage_path as string)
  const { error } = await adminClient.from('documentos').delete().eq('id', documentId)
  if (error) return { ok: false, message: error.message }

  await logAudit(
    supabase,
    {
      action_type: 'FILE_DELETE',
      description: `Admin eliminó "${doc.name}" de la bóveda del cliente`,
      target_type: 'document',
      target_id: documentId,
      target_label: doc.name as string,
      metadata: { storage_path: doc.storage_path, client_user_id: doc.user_id, by_admin: true },
    },
    {
      actor_id: caller.id,
      actor_email: profile?.email ?? caller.email ?? null,
      actor_name: profile?.full_name ?? null,
      actor_kind: 'admin',
    },
  )

  revalidatePath('/admin')
  return { ok: true, message: `Archivo "${doc.name}" eliminado.` }
}

export async function adminDeleteVaultFolderAction(folderId: string): Promise<VaultActionState> {
  const ctx = await requireAdminVaultCaller()
  if (!ctx) return { ok: false, message: 'Sin permisos.' }

  const { supabase, adminClient, caller, profile } = ctx

  const { data: rootFolder } = await adminClient
    .from('carpetas')
    .select('id, name, user_id')
    .eq('id', folderId)
    .single()

  if (!rootFolder) return { ok: false, message: 'Carpeta no encontrada.' }

  const { data: allFolders } = await adminClient
    .from('carpetas')
    .select('id, parent_id')
    .eq('user_id', rootFolder.user_id as string)

  const folderIds = new Set<string>([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const f of allFolders ?? []) {
      if (f.parent_id && folderIds.has(f.parent_id as string) && !folderIds.has(f.id as string)) {
        folderIds.add(f.id as string)
        changed = true
      }
    }
  }

  const folderIdList = [...folderIds]
  const { data: filesToDelete } = await adminClient
    .from('documentos')
    .select('id, name, storage_path')
    .in('folder_id', folderIdList)

  for (const file of filesToDelete ?? []) {
    if (file.storage_path) {
      await adminClient.storage.from('boveda').remove([file.storage_path as string])
      await adminClient.from('shared_links').delete().eq('storage_path', file.storage_path as string)
    }
  }

  if (filesToDelete?.length) {
    await adminClient.from('documentos').delete().in('id', filesToDelete.map(f => f.id as string))
  }

  for (const fid of folderIdList) {
    await adminClient.from('carpetas').delete().eq('id', fid)
  }

  await logAudit(
    supabase,
    {
      action_type: 'FOLDER_DELETE',
      description: `Admin eliminó carpeta "${rootFolder.name}" (${filesToDelete?.length ?? 0} archivos)`,
      target_type: 'folder',
      target_id: folderId,
      target_label: rootFolder.name as string,
      metadata: { folders_deleted: folderIdList.length, files_deleted: filesToDelete?.length ?? 0, by_admin: true },
    },
    {
      actor_id: caller.id,
      actor_email: profile?.email ?? caller.email ?? null,
      actor_name: profile?.full_name ?? null,
      actor_kind: 'admin',
    },
  )

  revalidatePath('/admin')
  return { ok: true, message: `Carpeta eliminada (${filesToDelete?.length ?? 0} archivos).` }
}

// ─── Audit logs (server-side paginated) ────────────────────────────────────────

export interface AuditLogServerRow {
  id: string
  actor_id: string | null
  actor_email: string | null
  actor_name: string | null
  actor_role?: string | null
  actor_kind?: string | null
  action_type: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
  ip_address?: string | null
  user_agent?: string | null
}

export async function getAuditLogsAction(params: {
  page?: number
  pageSize?: number
  search?: string
  actionTypes?: string[]
  actorId?: string
  actorKind?: 'all' | 'admin' | 'principal' | 'sub' | 'anonymous' | 'system'
  category?: 'all' | 'admin' | 'users' | 'files' | 'auth' | 'data' | 'system'
  riskLevel?: 'all' | 'low' | 'medium' | 'high' | 'critical'
  dateFrom?: string
  dateTo?: string
  criticalOnly?: boolean
}): Promise<{ rows: AuditLogServerRow[]; total: number }> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { rows: [], total: 0 }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { rows: [], total: 0 }

  const adminClient = await getAdminClient()
  const page     = params.page ?? 0
  const pageSize = params.pageSize ?? 15
  const from     = page * pageSize
  const to       = from + pageSize - 1

  // Resolve actor_kind filter via profiles when column missing on old rows
  let actorIdsFilter: string[] | null = null
  if (params.actorKind && params.actorKind !== 'all') {
    if (params.actorKind === 'anonymous') {
      // handled separately
    } else if (params.actorKind === 'system') {
      // action_type SYSTEM or actor_kind system
    } else {
      let profileQuery = adminClient.from('profiles').select('id')
      if (params.actorKind === 'admin') {
        profileQuery = profileQuery.eq('role', 'admin')
      } else if (params.actorKind === 'principal') {
        profileQuery = applyPrincipalClientFilters(profileQuery)
      } else if (params.actorKind === 'sub') {
        profileQuery = profileQuery.eq('role', 'user').not('parent_user_id', 'is', null)
      }
      const { data: profileIds } = await profileQuery
      actorIdsFilter = (profileIds ?? []).map(p => p.id)
    }
  }

  // Build action type list from category + risk + explicit actionTypes
  const { CATEGORY_ACTIONS, RISK_LEVEL_ACTIONS } = await import('@/lib/audit-log')
  let typeFilters: string[] | undefined = params.actionTypes?.length ? [...params.actionTypes] : undefined

  if (params.category && params.category !== 'all') {
    const catTypes = CATEGORY_ACTIONS[params.category]
    typeFilters = typeFilters
      ? typeFilters.filter(t => catTypes.includes(t as never))
      : [...catTypes]
  }

  const effectiveRisk = params.criticalOnly ? 'critical' : params.riskLevel
  if (effectiveRisk && effectiveRisk !== 'all') {
    const riskTypes = RISK_LEVEL_ACTIONS[effectiveRisk]
    typeFilters = typeFilters
      ? typeFilters.filter(t => riskTypes.includes(t as never))
      : [...riskTypes]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = adminClient
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.actorId && params.actorId !== 'all') {
    query = query.eq('actor_id', params.actorId)
  }

  if (params.actorKind === 'anonymous') {
    query = query.is('actor_id', null)
  } else if (params.actorKind === 'system') {
    query = query.or('actor_kind.eq.system,action_type.eq.SYSTEM')
  } else if (actorIdsFilter !== null) {
    if (actorIdsFilter.length === 0) return { rows: [], total: 0 }
    query = query.in('actor_id', actorIdsFilter)
  }

  if (params.dateFrom) {
    query = query.gte('created_at', new Date(params.dateFrom + 'T00:00:00').toISOString())
  }
  if (params.dateTo) {
    query = query.lte('created_at', new Date(params.dateTo + 'T23:59:59').toISOString())
  }
  if (typeFilters && typeFilters.length > 0) {
    query = query.in('action_type', typeFilters)
  } else if (typeFilters && typeFilters.length === 0) {
    return { rows: [], total: 0 }
  }

  if (params.search?.trim()) {
    const q = params.search.trim()
    query = query.or(
      `description.ilike.%${q}%,actor_name.ilike.%${q}%,actor_email.ilike.%${q}%,target_label.ilike.%${q}%`
    )
  }

  const { data, count, error } = await query
  if (error || !data) return { rows: [], total: 0 }

  return { rows: data as AuditLogServerRow[], total: count ?? 0 }
}

// ─── Security / Login History ──────────────────────────────────────────────────

export interface LoginAttemptRow {
  id: string
  email: string
  ip_address: string
  user_agent: string
  success: boolean
  attempted_at: string
  full_name?: string | null
}

export interface BruteForceAlert {
  email: string
  ip_address: string
  failCount: number
  lastAttempt: string
  isCurrentlyBlocked: boolean
}

export interface LoginStats {
  loginsToday: number
  failedToday: number
  failedThisHour: number
  uniqueUsersToday: number
  bruteForceAlerts: BruteForceAlert[]
}

/** Returns KPI stats and brute-force alerts for the security dashboard */
export async function getLoginStatsAction(): Promise<LoginStats> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { loginsToday: 0, failedToday: 0, failedThisHour: 0, uniqueUsersToday: 0, bruteForceAlerts: [] }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { loginsToday: 0, failedToday: 0, failedThisHour: 0, uniqueUsersToday: 0, bruteForceAlerts: [] }

  const adminClient = await getAdminClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const hourAgo    = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const dayAgo     = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [todayRes, failedTodayRes, failedHourRes, recentAllRes] = await Promise.all([
    adminClient.from('login_attempts').select('id', { count: 'exact', head: true }).eq('success', true).gte('attempted_at', todayStart),
    adminClient.from('login_attempts').select('id', { count: 'exact', head: true }).eq('success', false).gte('attempted_at', todayStart),
    adminClient.from('login_attempts').select('id', { count: 'exact', head: true }).eq('success', false).gte('attempted_at', hourAgo),
    adminClient.from('login_attempts').select('email, ip_address, success, attempted_at').gte('attempted_at', dayAgo).order('attempted_at', { ascending: false }).limit(2000),
  ])

  // Unique successful users today
  const todayRows = recentAllRes.data ?? []
  const uniqueUsers = new Set(todayRows.filter(r => r.success && r.attempted_at >= todayStart).map(r => r.email)).size

  // Brute-force detection: email+IP with 5+ failures in last 60 min
  const failedRecent = todayRows.filter(r => !r.success && r.attempted_at >= hourAgo)
  const grouped = new Map<string, { email: string; ip_address: string; count: number; last: string }>()
  for (const row of failedRecent) {
    const key = `${row.email}::${row.ip_address}`
    const prev = grouped.get(key) ?? { email: row.email, ip_address: row.ip_address, count: 0, last: row.attempted_at }
    prev.count++
    if (row.attempted_at > prev.last) prev.last = row.attempted_at
    grouped.set(key, prev)
  }

  const bruteForceAlerts: BruteForceAlert[] = Array.from(grouped.values())
    .filter(g => g.count >= 3)
    .sort((a, b) => b.count - a.count)
    .map(g => ({
      email: g.email,
      ip_address: g.ip_address,
      failCount: g.count,
      lastAttempt: g.last,
      isCurrentlyBlocked: g.count >= 5,
    }))

  return {
    loginsToday:      todayRes.count       ?? 0,
    failedToday:      failedTodayRes.count ?? 0,
    failedThisHour:   failedHourRes.count  ?? 0,
    uniqueUsersToday: uniqueUsers,
    bruteForceAlerts,
  }
}

/** Returns paginated login history with optional filters */
export async function getLoginHistoryAction(params: {
  page?: number
  pageSize?: number
  email?: string
  onlyFailed?: boolean
}): Promise<{ rows: LoginAttemptRow[]; total: number }> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { rows: [], total: 0 }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { rows: [], total: 0 }

  const adminClient = await getAdminClient()
  const page     = params.page ?? 0
  const pageSize = params.pageSize ?? 20
  const from     = page * pageSize
  const to       = from + pageSize - 1

  let query = adminClient
    .from('login_attempts')
    .select('id, email, ip_address, user_agent, success, attempted_at', { count: 'exact' })
    .order('attempted_at', { ascending: false })
    .range(from, to)

  if (params.email?.trim()) {
    query = query.ilike('email', `%${params.email.trim()}%`)
  }
  if (params.onlyFailed) {
    query = query.eq('success', false)
  }

  const { data, count, error } = await query
  if (error || !data) return { rows: [], total: 0 }

  // Enrich with profile full_name
  const emails  = [...new Set(data.map(r => r.email))]
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('email, full_name')
    .in('email', emails)

  const nameMap = new Map((profiles ?? []).map(p => [p.email, p.full_name]))

  return {
    rows: data.map(r => ({ ...r, full_name: nameMap.get(r.email) ?? null })) as LoginAttemptRow[],
    total: count ?? 0,
  }
}

/** Delete a backup file */
export async function deleteBackupAction(fileName: string): Promise<BackupState> {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { ok: false, message: 'Sesión expirada.' }

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return { ok: false, message: 'Sin permisos.' }

  const adminClient = await getAdminClient()
  const { error } = await adminClient.storage.from(BACKUP_BUCKET).remove([fileName])
  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin')
  return { ok: true, message: 'Backup eliminado.' }
}
