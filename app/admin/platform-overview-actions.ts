'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isPrincipalClientProfile } from '@/lib/profiles/principal-clients'

const BACKUP_BUCKET = 'db-backups'
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000
const BACKUP_STALE_DAYS = 7

const DB_LIMIT_BYTES =
  (Number(process.env.SUPABASE_DB_LIMIT_MB) || 500) * 1024 * 1024

const STORAGE_LIMIT_BYTES =
  (Number(process.env.SUPABASE_STORAGE_LIMIT_GB) || 1) * 1024 * 1024 * 1024

export type HealthStatus = 'ok' | 'warning' | 'critical'

export interface HealthAlert {
  level: 'warning' | 'critical'
  message: string
}

export interface LastBackupInfo {
  fileName: string
  createdAt: string
  sizeBytes: number
  daysSince: number
}

export interface TopVaultClient {
  id: string
  name: string
  email: string | null
  bytes: number
  fileCount: number
}

export interface PlatformTableStat {
  name: string
  sizeBytes: number
  rowEstimate: number
}

export interface PlatformOverviewData {
  databaseUsedBytes: number
  databaseLimitBytes: number
  storageUsedBytes: number
  storageLimitBytes: number
  storageBreakdown: {
    vaultBytes: number
    vaultFiles: number
    backupBytes: number
    backupCount: number
  }
  topTables: PlatformTableStat[]
  health: {
    status: HealthStatus
    alerts: HealthAlert[]
  }
  lastBackup: LastBackupInfo | null
  topVaultClients: TopVaultClient[]
  counts: {
    totalUsers: number
    totalClients: number
    totalSubusers: number
    totalAdmins: number
    totalModules: number
    activeModules: number
    auditLogsWeek: number
    notificationsActive: number
    sharedLinksActive: number
    onlineNow: number
    blockedAccounts: number
  }
  dbStatsAvailable: boolean
}

function pctUsed(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function parseBackupCreatedAt(fileName: string, fallback?: string | null): string {
  const match = fileName.match(/backup_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/)
  if (match) {
    const [, date, time] = match
    return `${date}T${time.replace(/-/g, ':')}:00.000Z`
  }
  return fallback ?? new Date().toISOString()
}

function daysSince(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)))
}

function buildHealthAlerts(input: {
  dbStatsAvailable: boolean
  databaseUsedBytes: number
  databaseLimitBytes: number
  storageUsedBytes: number
  storageLimitBytes: number
  lastBackup: LastBackupInfo | null
}): { status: HealthStatus; alerts: HealthAlert[] } {
  const alerts: HealthAlert[] = []

  if (input.dbStatsAvailable) {
    const dbPct = pctUsed(input.databaseUsedBytes, input.databaseLimitBytes)
    if (dbPct >= 90) {
      alerts.push({ level: 'critical', message: `Base de datos al ${dbPct}% de capacidad` })
    } else if (dbPct >= 75) {
      alerts.push({ level: 'warning', message: `Base de datos al ${dbPct}% de capacidad` })
    }
  }

  const storagePct = pctUsed(input.storageUsedBytes, input.storageLimitBytes)
  if (storagePct >= 90) {
    alerts.push({ level: 'critical', message: `Almacenamiento al ${storagePct}% de capacidad` })
  } else if (storagePct >= 75) {
    alerts.push({ level: 'warning', message: `Almacenamiento al ${storagePct}% de capacidad` })
  }

  if (!input.lastBackup) {
    alerts.push({ level: 'warning', message: 'No hay copias de seguridad registradas' })
  } else if (input.lastBackup.daysSince > BACKUP_STALE_DAYS) {
    alerts.push({
      level: 'warning',
      message: `Último backup hace ${input.lastBackup.daysSince} días (recomendado: cada ${BACKUP_STALE_DAYS} días)`,
    })
  }

  const status: HealthStatus = alerts.some(a => a.level === 'critical')
    ? 'critical'
    : alerts.some(a => a.level === 'warning')
      ? 'warning'
      : 'ok'

  return { status, alerts }
}

function getAdminServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return getAdminServiceClient()
}

export async function getPlatformOverviewAction(): Promise<PlatformOverviewData | null> {
  const admin = await requireAdmin()
  if (!admin) return null

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const onlineSince = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString()

  const [
    dbStatsRes,
    profilesRes,
    modulesRes,
    docsRes,
    backupsRes,
    auditRes,
    notifRes,
    linksRes,
  ] = await Promise.all([
    admin.rpc('admin_platform_db_stats'),
    admin.from('profiles').select('id, role, parent_user_id, last_activity_at, is_active, full_name, email, is_tech_inspector'),
    admin.from('modules').select('id, is_active'),
    admin.from('documentos').select('user_id, size'),
    admin.storage.from(BACKUP_BUCKET).list('', {
      limit: 200,
      sortBy: { column: 'created_at', order: 'desc' },
    }),
    admin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo),
    admin
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .lte('active_from', new Date().toISOString())
      .gte('active_until', new Date().toISOString()),
    admin
      .from('shared_links')
      .select('id', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString()),
  ])

  let databaseUsedBytes = 0
  let topTables: PlatformTableStat[] = []
  let dbStatsAvailable = false

  if (!dbStatsRes.error && dbStatsRes.data) {
    const raw = dbStatsRes.data as {
      database_bytes?: number
      top_tables?: Array<{ name: string; size_bytes: number; row_estimate: number }>
    }
    databaseUsedBytes = Number(raw.database_bytes) || 0
    topTables = (raw.top_tables ?? []).map(t => ({
      name: t.name,
      sizeBytes: Number(t.size_bytes) || 0,
      rowEstimate: Number(t.row_estimate) || 0,
    }))
    dbStatsAvailable = true
  }

  const profiles = profilesRes.data ?? []
  const totalUsers = profiles.length
  const totalAdmins = profiles.filter(p => p.role === 'admin').length
  const totalClients = profiles.filter(isPrincipalClientProfile).length
  const totalSubusers = profiles.filter(p => p.role === 'user' && p.parent_user_id).length
  const onlineNow = profiles.filter(
    p => p.is_active && p.last_activity_at && p.last_activity_at >= onlineSince,
  ).length
  const blockedAccounts = profiles.filter(p => !p.is_active).length

  const modules = modulesRes.data ?? []
  const docs = docsRes.data ?? []
  const vaultFiles = docs.length
  const vaultBytes = docs.reduce(
    (sum, row) => sum + (Number(row.size) || 0),
    0,
  )

  const vaultByUser = new Map<string, { bytes: number; files: number }>()
  for (const row of docs) {
    const userId = row.user_id as string
    if (!userId) continue
    const entry = vaultByUser.get(userId) ?? { bytes: 0, files: 0 }
    entry.bytes += Number(row.size) || 0
    entry.files += 1
    vaultByUser.set(userId, entry)
  }

  const profileById = new Map(profiles.map(p => [p.id, p]))
  const topVaultClients: TopVaultClient[] = [...vaultByUser.entries()]
    .map(([id, stats]) => {
      const profile = profileById.get(id)
      return {
        id,
        name: profile?.full_name || profile?.email || 'Sin nombre',
        email: profile?.email ?? null,
        bytes: stats.bytes,
        fileCount: stats.files,
      }
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)

  const backupFiles = (backupsRes.data ?? []).filter(
    f => f.name.endsWith('.json') && f.name !== '.emptyFolderPlaceholder',
  )
  const backupBytes = backupFiles.reduce(
    (sum, f) => sum + (Number(f.metadata?.size) || 0),
    0,
  )

  const sortedBackups = backupFiles
    .map(f => ({
      fileName: f.name,
      createdAt: parseBackupCreatedAt(f.name, f.created_at),
      sizeBytes: Number(f.metadata?.size) || 0,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const lastBackup: LastBackupInfo | null = sortedBackups[0]
    ? {
        ...sortedBackups[0],
        daysSince: daysSince(sortedBackups[0].createdAt),
      }
    : null

  const storageUsedBytes = vaultBytes + backupBytes
  const health = buildHealthAlerts({
    dbStatsAvailable,
    databaseUsedBytes,
    databaseLimitBytes: DB_LIMIT_BYTES,
    storageUsedBytes,
    storageLimitBytes: STORAGE_LIMIT_BYTES,
    lastBackup,
  })

  return {
    databaseUsedBytes,
    databaseLimitBytes: DB_LIMIT_BYTES,
    storageUsedBytes,
    storageLimitBytes: STORAGE_LIMIT_BYTES,
    storageBreakdown: {
      vaultBytes,
      vaultFiles,
      backupBytes,
      backupCount: backupFiles.length,
    },
    topTables,
    health,
    lastBackup,
    topVaultClients,
    counts: {
      totalUsers,
      totalClients,
      totalSubusers,
      totalAdmins,
      totalModules: modules.length,
      activeModules: modules.filter(m => m.is_active).length,
      auditLogsWeek: auditRes.count ?? 0,
      notificationsActive: notifRes.count ?? 0,
      sharedLinksActive: linksRes.count ?? 0,
      onlineNow,
      blockedAccounts,
    },
    dbStatsAvailable,
  }
}
