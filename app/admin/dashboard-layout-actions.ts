'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit-log'
import type { WidgetConfig } from '@/lib/dashboard/widget-config'
import {
  buildDefaultHomeLayout,
  mergeLayoutWithCatalog,
  normalizeLayoutOrders,
  parseStoredLayout,
  resolvePlatformOrSystemDefault,
  validateLayoutForSave,
} from '@/lib/dashboard/widget-catalog'
import {
  fetchLayoutProfileRef,
  formatLayoutUserLabel,
  resolveDashboardLayoutOwnerId,
} from '@/lib/dashboard/layout-owner'
import { applyPrincipalClientFilters } from '@/lib/profiles/principal-clients'

export type ResetLayoutSource = 'system' | 'platform'

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
  if (!user) {
    return {
      ok: false as const,
      message: 'No autorizado.',
      userId: null as string | null,
      supabase,
      actorName: null as string | null,
      actorEmail: null as string | null,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return {
      ok: false as const,
      message: 'Solo administradores.',
      userId: null as string | null,
      supabase,
      actorName: null as string | null,
      actorEmail: null as string | null,
    }
  }

  return {
    ok: true as const,
    userId: user.id,
    supabase,
    actorName: profile.full_name ?? null,
    actorEmail: profile.email ?? user.email ?? null,
  }
}

async function fetchPlatformDefaultRaw(admin: ReturnType<typeof getServiceClient>) {
  if (!admin) return null
  const { data } = await admin
    .from('platform_dashboard_default')
    .select('configuration')
    .eq('id', 1)
    .maybeSingle()
  return parseStoredLayout(data?.configuration)
}

async function resolveLayoutOwnerContext(
  admin: NonNullable<ReturnType<typeof getServiceClient>>,
  userId: string,
) {
  const profile = await fetchLayoutProfileRef(admin, userId)
  const layoutOwnerId = resolveDashboardLayoutOwnerId(userId, profile?.parent_user_id)
  const ownerProfile =
    layoutOwnerId === userId ? profile : await fetchLayoutProfileRef(admin, layoutOwnerId)

  return {
    profile,
    layoutOwnerId,
    ownerProfile,
    inheritsFromParent: Boolean(profile?.parent_user_id),
    layoutOwnerLabel: formatLayoutUserLabel(ownerProfile, layoutOwnerId),
  }
}

function visibleWidgetSummary(widgets: WidgetConfig[]): string {
  const visible = widgets.filter((w) => w.visible).map((w) => w.title)
  return visible.length > 0 ? visible.join(', ') : 'ninguno'
}

async function logDashboardLayoutAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actor: { userId: string; actorName: string | null; actorEmail: string | null },
  entry: {
    action: 'UPDATE_DASHBOARD_LAYOUT' | 'UPDATE_PLATFORM_DASHBOARD'
    description: string
    targetUserId?: string | null
    targetLabel?: string | null
    metadata?: Record<string, unknown>
  },
) {
  await logAudit(
    supabase,
    {
      action_type: entry.action,
      description: entry.description,
      target_type: entry.targetUserId ? 'user' : 'dashboard_layout',
      target_id: entry.targetUserId ?? null,
      target_label: entry.targetLabel ?? null,
      metadata: entry.metadata ?? null,
    },
    {
      actor_id: actor.userId,
      actor_name: actor.actorName,
      actor_email: actor.actorEmail,
      actor_kind: 'admin',
    },
  )
}

export type LayoutUserOption = {
  id: string
  email: string
  full_name: string | null
  role: string
  parent_user_id: string | null
}

export async function listDashboardLayoutUsersAction(): Promise<{
  ok: boolean
  message?: string
  users: LayoutUserOption[]
}> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message, users: [] }

  const admin = getServiceClient()
  if (!admin) return { ok: false, message: 'Servicio no disponible.', users: [] }

  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role, parent_user_id, is_tech_inspector')
    .order('email', { ascending: true })

  if (error) return { ok: false, message: error.message, users: [] }

  return {
    ok: true,
    users: (data ?? []).filter(
      u => u.role !== 'admin' && !u.is_tech_inspector,
    ) as LayoutUserOption[],
  }
}

export async function getPlatformDefaultLayoutAction(): Promise<{
  ok: boolean
  message?: string
  widgets: WidgetConfig[]
  isConfigured: boolean
}> {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return { ok: false, message: auth.message, widgets: buildDefaultHomeLayout(), isConfigured: false }
  }

  const admin = getServiceClient()
  if (!admin) {
    return { ok: false, message: 'Servicio no disponible.', widgets: buildDefaultHomeLayout(), isConfigured: false }
  }

  const parsed = await fetchPlatformDefaultRaw(admin)
  const isConfigured = Boolean(parsed?.length)

  return {
    ok: true,
    widgets: isConfigured ? mergeLayoutWithCatalog(parsed) : buildDefaultHomeLayout(),
    isConfigured,
  }
}

export async function savePlatformDefaultLayoutAction(
  widgets: WidgetConfig[],
): Promise<{ ok: boolean; message: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const validation = validateLayoutForSave(widgets)
  if (!validation.ok) {
    return { ok: false, message: validation.message ?? 'Configuración inválida.' }
  }

  const admin = getServiceClient()
  if (!admin) return { ok: false, message: 'Servicio no disponible.' }

  const normalized = normalizeLayoutOrders(
    widgets.map((w) => ({ ...w, moduleId: undefined, props: undefined })),
  )

  const { error } = await admin.from('platform_dashboard_default').upsert(
    {
      id: 1,
      configuration: normalized,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    },
    { onConflict: 'id' },
  )

  if (error) return { ok: false, message: error.message }

  const actorLabel = auth.actorName || auth.actorEmail || 'Admin'
  await logDashboardLayoutAudit(auth.supabase, auth, {
    action: 'UPDATE_PLATFORM_DASHBOARD',
    description: `${actorLabel} actualizó la plantilla global de Inicio Up Crop (${normalized.filter((w) => w.visible).length} widgets visibles)`,
    metadata: {
      operation: 'save_platform',
      visible_widgets: visibleWidgetSummary(normalized),
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/admin')

  return { ok: true, message: 'Plantilla predeterminada de Up Crop guardada.' }
}

export async function getDashboardLayoutForUserAction(userId: string): Promise<{
  ok: boolean
  message?: string
  widgets: WidgetConfig[]
  isCustom: boolean
  fallbackLabel: string
  inheritsFromParent: boolean
  layoutOwnerId: string
  layoutOwnerLabel: string
}> {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return {
      ok: false,
      message: auth.message,
      widgets: [],
      isCustom: false,
      fallbackLabel: 'Sistema',
      inheritsFromParent: false,
      layoutOwnerId: userId,
      layoutOwnerLabel: '',
    }
  }

  const admin = getServiceClient()
  if (!admin) {
    return {
      ok: false,
      message: 'Servicio no disponible.',
      widgets: [],
      isCustom: false,
      fallbackLabel: 'Sistema',
      inheritsFromParent: false,
      layoutOwnerId: userId,
      layoutOwnerLabel: '',
    }
  }

  const platformParsed = await fetchPlatformDefaultRaw(admin)
  const fallbackLabel = platformParsed?.length ? 'Plantilla Up Crop' : 'Sistema (código)'
  const ownerCtx = await resolveLayoutOwnerContext(admin, userId)

  const { data, error } = await admin
    .from('dashboard_layouts')
    .select('configuration')
    .eq('user_id', ownerCtx.layoutOwnerId)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      message: error.message,
      widgets: [],
      isCustom: false,
      fallbackLabel,
      inheritsFromParent: ownerCtx.inheritsFromParent,
      layoutOwnerId: ownerCtx.layoutOwnerId,
      layoutOwnerLabel: ownerCtx.layoutOwnerLabel,
    }
  }

  if (data?.configuration) {
    const parsed = parseStoredLayout(data.configuration)
    return {
      ok: true,
      widgets: mergeLayoutWithCatalog(parsed),
      isCustom: true,
      fallbackLabel,
      inheritsFromParent: ownerCtx.inheritsFromParent,
      layoutOwnerId: ownerCtx.layoutOwnerId,
      layoutOwnerLabel: ownerCtx.layoutOwnerLabel,
    }
  }

  return {
    ok: true,
    widgets: resolvePlatformOrSystemDefault(platformParsed),
    isCustom: false,
    fallbackLabel,
    inheritsFromParent: ownerCtx.inheritsFromParent,
    layoutOwnerId: ownerCtx.layoutOwnerId,
    layoutOwnerLabel: ownerCtx.layoutOwnerLabel,
  }
}

export async function saveDashboardLayoutForUserAction(
  userId: string,
  widgets: WidgetConfig[],
): Promise<{ ok: boolean; message: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const validation = validateLayoutForSave(widgets)
  if (!validation.ok) {
    return { ok: false, message: validation.message ?? 'Configuración inválida.' }
  }

  const admin = getServiceClient()
  if (!admin) return { ok: false, message: 'Servicio no disponible.' }

  const ownerCtx = await resolveLayoutOwnerContext(admin, userId)
  const normalized = normalizeLayoutOrders(
    widgets.map((w) => ({ ...w, moduleId: undefined, props: undefined })),
  )

  const { error } = await admin.from('dashboard_layouts').upsert(
    {
      user_id: ownerCtx.layoutOwnerId,
      configuration: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) return { ok: false, message: error.message }

  const actorLabel = auth.actorName || auth.actorEmail || 'Admin'
  const targetLabel = ownerCtx.layoutOwnerLabel
  const selectedLabel = formatLayoutUserLabel(ownerCtx.profile, userId)
  const description = ownerCtx.inheritsFromParent
    ? `${actorLabel} guardó el layout de Inicio de ${targetLabel} (subusuario ${selectedLabel} hereda este layout)`
    : `${actorLabel} guardó el layout de Inicio de ${targetLabel}`

  await logDashboardLayoutAudit(auth.supabase, auth, {
    action: 'UPDATE_DASHBOARD_LAYOUT',
    description,
    targetUserId: ownerCtx.layoutOwnerId,
    targetLabel,
    metadata: {
      operation: 'save_user',
      selected_user_id: userId,
      selected_user_label: selectedLabel,
      inherits_from_parent: ownerCtx.inheritsFromParent,
      visible_widgets: visibleWidgetSummary(normalized),
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/admin')

  return {
    ok: true,
    message: ownerCtx.inheritsFromParent
      ? `Layout guardado para ${targetLabel}. Los subusuarios verán el mismo Inicio.`
      : 'Layout de Inicio guardado.',
  }
}

export async function resetDashboardLayoutForUserAction(
  userId: string,
  source: ResetLayoutSource,
): Promise<{ ok: boolean; message: string; widgets: WidgetConfig[]; isCustom: boolean }> {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return {
      ok: false,
      message: auth.message,
      widgets: buildDefaultHomeLayout(),
      isCustom: false,
    }
  }

  const admin = getServiceClient()
  if (!admin) {
    return {
      ok: false,
      message: 'Servicio no disponible.',
      widgets: buildDefaultHomeLayout(),
      isCustom: false,
    }
  }

  const platformParsed = await fetchPlatformDefaultRaw(admin)
  const ownerCtx = await resolveLayoutOwnerContext(admin, userId)
  const actorLabel = auth.actorName || auth.actorEmail || 'Admin'
  const targetLabel = ownerCtx.layoutOwnerLabel
  const selectedLabel = formatLayoutUserLabel(ownerCtx.profile, userId)

  if (source === 'platform') {
    await admin.from('dashboard_layouts').delete().eq('user_id', ownerCtx.layoutOwnerId)
    revalidatePath('/dashboard')
    revalidatePath('/admin')
    const widgets = resolvePlatformOrSystemDefault(platformParsed)
    const message = platformParsed?.length
      ? 'Layout restaurado a la plantilla Up Crop. El usuario heredará cambios futuros de la plantilla.'
      : 'Layout restaurado al predeterminado del sistema (aún no hay plantilla Up Crop guardada).'

    const description = ownerCtx.inheritsFromParent
      ? `${actorLabel} restauró el Inicio de ${targetLabel} a plantilla Up Crop (afecta al subusuario ${selectedLabel})`
      : `${actorLabel} restauró el Inicio de ${targetLabel} a plantilla Up Crop`

    await logDashboardLayoutAudit(auth.supabase, auth, {
      action: 'UPDATE_DASHBOARD_LAYOUT',
      description,
      targetUserId: ownerCtx.layoutOwnerId,
      targetLabel,
      metadata: {
        operation: 'reset_user',
        reset_source: 'platform',
        selected_user_id: userId,
        inherits_from_parent: ownerCtx.inheritsFromParent,
      },
    })

    return { ok: true, message, widgets, isCustom: false }
  }

  const widgets = buildDefaultHomeLayout()
  const normalized = normalizeLayoutOrders(
    widgets.map((w) => ({ ...w, moduleId: undefined, props: undefined })),
  )

  const { error } = await admin.from('dashboard_layouts').upsert(
    {
      user_id: ownerCtx.layoutOwnerId,
      configuration: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    return { ok: false, message: error.message, widgets: normalized, isCustom: false }
  }

  revalidatePath('/dashboard')
  revalidatePath('/admin')

  const description = ownerCtx.inheritsFromParent
    ? `${actorLabel} restauró el Inicio de ${targetLabel} al default del sistema (afecta al subusuario ${selectedLabel})`
    : `${actorLabel} restauró el Inicio de ${targetLabel} al default del sistema`

  await logDashboardLayoutAudit(auth.supabase, auth, {
    action: 'UPDATE_DASHBOARD_LAYOUT',
    description,
    targetUserId: ownerCtx.layoutOwnerId,
    targetLabel,
    metadata: {
      operation: 'reset_user',
      reset_source: 'system',
      selected_user_id: userId,
      inherits_from_parent: ownerCtx.inheritsFromParent,
    },
  })

  return {
    ok: true,
    message: 'Layout restaurado al predeterminado del sistema (código).',
    widgets: normalized,
    isCustom: true,
  }
}

async function resolveUserLayoutWidgets(
  admin: NonNullable<ReturnType<typeof getServiceClient>>,
  userId: string,
): Promise<WidgetConfig[]> {
  const platformParsed = await fetchPlatformDefaultRaw(admin)
  const ownerCtx = await resolveLayoutOwnerContext(admin, userId)
  const { data } = await admin
    .from('dashboard_layouts')
    .select('configuration')
    .eq('user_id', ownerCtx.layoutOwnerId)
    .maybeSingle()

  if (data?.configuration) {
    return mergeLayoutWithCatalog(parseStoredLayout(data.configuration))
  }
  return resolvePlatformOrSystemDefault(platformParsed)
}

export async function copyDashboardLayoutFromUserAction(
  sourceUserId: string,
  targetUserId: string,
): Promise<{ ok: boolean; message: string; widgets: WidgetConfig[] }> {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return { ok: false, message: auth.message, widgets: [] }
  }

  if (sourceUserId === targetUserId) {
    return { ok: false, message: 'Elige un usuario distinto al destino.', widgets: [] }
  }

  const admin = getServiceClient()
  if (!admin) {
    return { ok: false, message: 'Servicio no disponible.', widgets: [] }
  }

  const sourceCtx = await resolveLayoutOwnerContext(admin, sourceUserId)
  const targetCtx = await resolveLayoutOwnerContext(admin, targetUserId)

  if (sourceCtx.layoutOwnerId === targetCtx.layoutOwnerId) {
    return {
      ok: false,
      message: 'Origen y destino comparten el mismo cliente principal.',
      widgets: [],
    }
  }

  const widgets = await resolveUserLayoutWidgets(admin, sourceUserId)
  const validation = validateLayoutForSave(widgets)
  if (!validation.ok) {
    return { ok: false, message: validation.message ?? 'Layout origen inválido.', widgets: [] }
  }

  const normalized = normalizeLayoutOrders(
    widgets.map((w) => ({ ...w, moduleId: undefined, props: undefined })),
  )

  const { error } = await admin.from('dashboard_layouts').upsert(
    {
      user_id: targetCtx.layoutOwnerId,
      configuration: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    return { ok: false, message: error.message, widgets: [] }
  }

  const actorLabel = auth.actorName || auth.actorEmail || 'Admin'
  const sourceLabel = sourceCtx.layoutOwnerLabel
  const targetLabel = targetCtx.layoutOwnerLabel
  const selectedTargetLabel = formatLayoutUserLabel(targetCtx.profile, targetUserId)

  const description = targetCtx.inheritsFromParent
    ? `${actorLabel} copió el layout de Inicio de ${sourceLabel} a ${targetLabel} (subusuario ${selectedTargetLabel} hereda)`
    : `${actorLabel} copió el layout de Inicio de ${sourceLabel} a ${targetLabel}`

  await logDashboardLayoutAudit(auth.supabase, auth, {
    action: 'UPDATE_DASHBOARD_LAYOUT',
    description,
    targetUserId: targetCtx.layoutOwnerId,
    targetLabel,
    metadata: {
      operation: 'copy_layout',
      source_user_id: sourceCtx.layoutOwnerId,
      source_user_label: sourceLabel,
      selected_target_user_id: targetUserId,
      inherits_from_parent: targetCtx.inheritsFromParent,
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/admin')

  return {
    ok: true,
    message: targetCtx.inheritsFromParent
      ? `Layout copiado a ${targetLabel}. Los subusuarios verán el mismo Inicio.`
      : 'Layout copiado y guardado en el usuario destino.',
    widgets: normalized,
  }
}

export async function applyPlatformTemplateToAllUsersAction(): Promise<{
  ok: boolean
  message: string
  appliedCount: number
}> {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return { ok: false, message: auth.message, appliedCount: 0 }
  }

  const admin = getServiceClient()
  if (!admin) {
    return { ok: false, message: 'Servicio no disponible.', appliedCount: 0 }
  }

  const platformParsed = await fetchPlatformDefaultRaw(admin)
  if (!platformParsed?.length) {
    return {
      ok: false,
      message: 'Primero guarda la plantilla Up Crop antes de aplicarla a todos.',
      appliedCount: 0,
    }
  }

  const widgets = mergeLayoutWithCatalog(platformParsed)
  const validation = validateLayoutForSave(widgets)
  if (!validation.ok) {
    return { ok: false, message: validation.message ?? 'Plantilla inválida.', appliedCount: 0 }
  }

  const normalized = normalizeLayoutOrders(
    widgets.map((w) => ({ ...w, moduleId: undefined, props: undefined })),
  )

  const { data: clients, error: usersError } = await applyPrincipalClientFilters(
    admin.from('profiles').select('id'),
  )

  if (usersError) {
    return { ok: false, message: usersError.message, appliedCount: 0 }
  }

  const clientIds = (clients ?? []).map((c) => c.id)
  if (clientIds.length === 0) {
    return { ok: false, message: 'No hay clientes principales para actualizar.', appliedCount: 0 }
  }

  const now = new Date().toISOString()
  const rows = clientIds.map((ownerId) => ({
    user_id: ownerId,
    configuration: normalized,
    updated_at: now,
  }))

  const { error: upsertError } = await admin
    .from('dashboard_layouts')
    .upsert(rows, { onConflict: 'user_id' })

  if (upsertError) {
    return { ok: false, message: upsertError.message, appliedCount: 0 }
  }

  const actorLabel = auth.actorName || auth.actorEmail || 'Admin'
  await logDashboardLayoutAudit(auth.supabase, auth, {
    action: 'UPDATE_PLATFORM_DASHBOARD',
    description: `${actorLabel} aplicó la plantilla Up Crop a ${clientIds.length} cliente${clientIds.length !== 1 ? 's' : ''} principales (subusuarios heredan del principal)`,
    metadata: {
      operation: 'apply_platform_all',
      applied_count: clientIds.length,
      visible_widgets: visibleWidgetSummary(normalized),
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/admin')

  return {
    ok: true,
    message: `Plantilla Up Crop aplicada a ${clientIds.length} cliente${clientIds.length !== 1 ? 's' : ''} principales. Los subusuarios heredan del principal.`,
    appliedCount: clientIds.length,
  }
}
