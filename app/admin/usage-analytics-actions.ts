'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export interface DailyActivePoint {
  date: string
  label: string
  count: number
}

export interface ModuleUsageRow {
  moduleName: string
  views: number
}

export interface ClientUsageRow {
  id: string
  name: string
  email: string | null
  activeThisWeek: boolean
  moduleViews: number
  topModule: string | null
  vaultUploads: number
  vaultDownloads: number
  excelImports: number
  documentsGenerated: number
  inventoryAlerts: number
  lastActive: string | null
}

export interface UsageAnalyticsData {
  totalUsers: number
  activeToday: number
  activeThisWeek: number
  loginsThisWeek: number
  vaultEventsWeek: number
  excelImportsWeek: number
  documentsGeneratedWeek: number
  inventoryAlertsNow: number
  moduleViewsWeek: number
  topModuleGlobal: { name: string; views: number } | null
  dailyActiveUsers: DailyActivePoint[]
  topModules: ModuleUsageRow[]
  clients: ClientUsageRow[]
}

function getAdminServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function resolveClientOwnerId(
  actorId: string | null,
  profileMap: Map<string, { parent_user_id: string | null; role: string }>,
): string | null {
  if (!actorId) return null
  const p = profileMap.get(actorId)
  if (!p) return actorId
  if (p.role === 'user' && p.parent_user_id) return p.parent_user_id
  if (p.role === 'user') return actorId
  return null
}

async function countInventoryAlerts(
  admin: NonNullable<ReturnType<typeof getAdminServiceClient>>,
  userId: string,
): Promise<number> {
  const [movementRes, minLevelRes] = await Promise.all([
    admin.from('inventory_movements').select('warehouse_id, material_id, type, quantity').eq('user_id', userId),
    admin.from('inventory_min_levels').select('warehouse_id, material_id, min_quantity').eq('user_id', userId),
  ])

  if (movementRes.error || minLevelRes.error) return 0

  const stockMap = new Map<string, number>()
  for (const mv of movementRes.data ?? []) {
    const key = `${mv.warehouse_id}:${mv.material_id}`
    const prev = stockMap.get(key) ?? 0
    const qty = Number(mv.quantity) || 0
    stockMap.set(key, prev + (mv.type === 'salida' ? -qty : qty))
  }

  let alerts = 0
  for (const level of minLevelRes.data ?? []) {
    const key = `${level.warehouse_id}:${level.material_id}`
    const stock = stockMap.get(key)
    if (stock !== undefined && stock <= Number(level.min_quantity)) alerts += 1
  }
  return alerts
}

function formatDayLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00')
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })
}

export async function getUsageAnalyticsAction(): Promise<UsageAnalyticsData | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'admin') return null

  const admin = getAdminServiceClient()
  if (!admin) return null

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekAgoIso = weekAgo.toISOString()

  const [
    profilesRes,
    loginsRes,
    auditRes,
    subusersRes,
  ] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, role, parent_user_id, last_activity_at')
      .eq('role', 'user')
      .is('parent_user_id', null),
    admin.from('login_attempts').select('id', { count: 'exact', head: true }).eq('success', true).gte('attempted_at', weekAgoIso),
    admin.from('audit_logs')
      .select('action_type, actor_id, target_label, metadata, created_at')
      .gte('created_at', weekAgoIso)
      .in('action_type', ['MODULE_VIEW', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'IMPORT_EXCEL', 'DOCUMENT_GENERATE'])
      .limit(8000),
    admin.from('profiles').select('id, parent_user_id, role').eq('role', 'user').not('parent_user_id', 'is', null),
  ])

  const principalClients = profilesRes.data ?? []
  const profileMap = new Map<string, { parent_user_id: string | null; role: string }>()
  for (const p of principalClients) {
    profileMap.set(p.id as string, { parent_user_id: p.parent_user_id as string | null, role: p.role as string })
  }
  for (const s of subusersRes.data ?? []) {
    profileMap.set(s.id as string, { parent_user_id: s.parent_user_id as string | null, role: 'user' })
  }

  const activeToday = principalClients.filter(p => p.last_activity_at && new Date(p.last_activity_at as string) >= todayStart).length
  const activeThisWeek = principalClients.filter(p => p.last_activity_at && new Date(p.last_activity_at as string) >= weekAgo).length

  const dailyActiveUsers: DailyActivePoint[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date(todayStart)
    day.setDate(day.getDate() - i)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const dateKey = day.toISOString().slice(0, 10)
    const count = principalClients.filter(p => {
      if (!p.last_activity_at) return false
      const t = new Date(p.last_activity_at as string)
      return t >= day && t < next
    }).length
    dailyActiveUsers.push({ date: dateKey, label: formatDayLabel(dateKey), count })
  }

  type ClientBucket = {
    moduleViews: number
    moduleCounts: Map<string, number>
    vaultUploads: number
    vaultDownloads: number
    excelImports: number
    documentsGenerated: number
  }

  const clientBuckets = new Map<string, ClientBucket>()
  const ensureBucket = (clientId: string) => {
    if (!clientBuckets.has(clientId)) {
      clientBuckets.set(clientId, {
        moduleViews: 0,
        moduleCounts: new Map(),
        vaultUploads: 0,
        vaultDownloads: 0,
        excelImports: 0,
        documentsGenerated: 0,
      })
    }
    return clientBuckets.get(clientId)!
  }

  let vaultEventsWeek = 0
  let excelImportsWeek = 0
  let documentsGeneratedWeek = 0
  let moduleViewsWeek = 0
  const globalModuleCounts = new Map<string, number>()

  for (const row of auditRes.data ?? []) {
    const clientId = resolveClientOwnerId(row.actor_id as string | null, profileMap)
    const action = row.action_type as string
    const meta = row.metadata as { module_name?: string } | null
    const moduleName = meta?.module_name ?? (row.target_label as string) ?? 'Módulo'

    if (action === 'MODULE_VIEW') {
      moduleViewsWeek += 1
      globalModuleCounts.set(moduleName, (globalModuleCounts.get(moduleName) ?? 0) + 1)
      if (clientId) {
        const b = ensureBucket(clientId)
        b.moduleViews += 1
        b.moduleCounts.set(moduleName, (b.moduleCounts.get(moduleName) ?? 0) + 1)
      }
    } else if (action === 'FILE_UPLOAD') {
      vaultEventsWeek += 1
      if (clientId) ensureBucket(clientId).vaultUploads += 1
    } else if (action === 'FILE_DOWNLOAD') {
      vaultEventsWeek += 1
      if (clientId) ensureBucket(clientId).vaultDownloads += 1
    } else if (action === 'IMPORT_EXCEL') {
      excelImportsWeek += 1
      if (clientId) ensureBucket(clientId).excelImports += 1
    } else if (action === 'DOCUMENT_GENERATE') {
      documentsGeneratedWeek += 1
      if (clientId) ensureBucket(clientId).documentsGenerated += 1
    }
  }

  const topModules: ModuleUsageRow[] = Array.from(globalModuleCounts.entries())
    .map(([moduleName, views]) => ({ moduleName, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)

  const inventoryAlertsMap = new Map<string, number>()
  let inventoryAlertsNow = 0
  const clientIds = principalClients.map(c => c.id as string)
  for (let i = 0; i < clientIds.length; i += 5) {
    const batch = clientIds.slice(i, i + 5)
    const counts = await Promise.all(batch.map(id => countInventoryAlerts(admin, id)))
    batch.forEach((id, idx) => {
      inventoryAlertsMap.set(id, counts[idx])
      inventoryAlertsNow += counts[idx]
    })
  }

  const clients: ClientUsageRow[] = principalClients.map(c => {
    const id = c.id as string
    const bucket = clientBuckets.get(id)
    let topModule: string | null = null
    if (bucket && bucket.moduleCounts.size > 0) {
      topModule = Array.from(bucket.moduleCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    }
    const lastActive = c.last_activity_at as string | null
    return {
      id,
      name: (c.full_name as string) || (c.email as string) || id,
      email: c.email as string | null,
      activeThisWeek: !!lastActive && new Date(lastActive) >= weekAgo,
      moduleViews: bucket?.moduleViews ?? 0,
      topModule,
      vaultUploads: bucket?.vaultUploads ?? 0,
      vaultDownloads: bucket?.vaultDownloads ?? 0,
      excelImports: bucket?.excelImports ?? 0,
      documentsGenerated: bucket?.documentsGenerated ?? 0,
      inventoryAlerts: inventoryAlertsMap.get(id) ?? 0,
      lastActive,
    }
  }).sort((a, b) =>
    b.moduleViews - a.moduleViews
    || (b.vaultUploads + b.vaultDownloads) - (a.vaultUploads + a.vaultDownloads),
  )

  return {
    totalUsers: principalClients.length,
    activeToday,
    activeThisWeek,
    loginsThisWeek: loginsRes.count ?? 0,
    vaultEventsWeek,
    excelImportsWeek,
    documentsGeneratedWeek,
    inventoryAlertsNow,
    moduleViewsWeek,
    topModuleGlobal: topModules[0] ?? null,
    dailyActiveUsers,
    topModules,
    clients,
  }
}
