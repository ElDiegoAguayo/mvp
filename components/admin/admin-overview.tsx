import Link from 'next/link'
import {
  Database, HardDrive, Users, Layers, FolderOpen,
  DatabaseBackup, ScrollText, Megaphone, Link2, Radio, AlertTriangle,
  CheckCircle2, ShieldAlert, Lock, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPlatformOverviewAction, type HealthStatus } from '@/app/admin/platform-overview-actions'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatRelativeDays(days: number): string {
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

const healthConfig: Record<HealthStatus, {
  label: string
  dot: string
  ring: string
  bg: string
  border: string
  text: string
  icon: React.ElementType
}> = {
  ok: {
    label: 'Sistema operativo normal',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  warning: {
    label: 'Atención requerida',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/30',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  critical: {
    label: 'Estado crítico',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/30',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-300',
    icon: ShieldAlert,
  },
}

function SystemHealthPanel({
  status,
  alerts,
}: {
  status: HealthStatus
  alerts: Array<{ level: 'warning' | 'critical'; message: string }>
}) {
  const cfg = healthConfig[status]
  const Icon = cfg.icon

  return (
    <div className={cn('rounded-2xl border p-4 sm:p-5 shadow-sm', cfg.bg, cfg.border)}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className={cn('relative w-12 h-12 rounded-full ring-4 flex items-center justify-center bg-card', cfg.ring)}>
            <span className={cn('relative flex h-4 w-4')}>
              {status !== 'ok' && (
                <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', cfg.dot)} />
              )}
              <span className={cn('relative inline-flex rounded-full h-4 w-4', cfg.dot)} />
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Salud del sistema</p>
            <p className={cn('text-sm font-bold', cfg.text)}>{cfg.label}</p>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Icon className={cn('w-4 h-4 shrink-0', cfg.text)} />
              Espacio y backups dentro de rangos normales.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map(alert => (
                <li
                  key={alert.message}
                  className={cn(
                    'text-xs flex items-start gap-1.5',
                    alert.level === 'critical' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300',
                  )}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function LastBackupCard({
  lastBackup,
}: {
  lastBackup: {
    fileName: string
    createdAt: string
    sizeBytes: number
    daysSince: number
  } | null
}) {
  const isStale = !lastBackup || lastBackup.daysSince > 7

  return (
    <div className={cn(
      'bg-card border rounded-2xl p-5 shadow-sm space-y-3',
      isStale ? 'border-amber-500/40' : 'border-border',
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
          isStale ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#4A6CF7]/10 border-[#4A6CF7]/20',
        )}>
          <DatabaseBackup className={cn('w-5 h-5', isStale ? 'text-amber-600 dark:text-amber-400' : 'text-[#4A6CF7]')} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Último backup</h2>
          {lastBackup ? (
            <p className="text-xs text-muted-foreground mt-0.5 truncate" title={lastBackup.fileName}>
              {formatDateTime(lastBackup.createdAt)} · {formatBytes(lastBackup.sizeBytes)}
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Sin copias registradas</p>
          )}
        </div>
        {lastBackup && (
          <span className={cn(
            'text-xs font-semibold px-2 py-1 rounded-full shrink-0',
            isStale
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
          )}>
            <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
            {formatRelativeDays(lastBackup.daysSince)}
          </span>
        )}
      </div>
      <Link
        href="/admin?tab=backups"
        className="text-xs text-[#4A6CF7] hover:underline inline-flex items-center gap-1"
      >
        Gestionar backups →
      </Link>
    </div>
  )
}

function TopVaultClientsPanel({
  clients,
  totalVaultBytes,
}: {
  clients: Array<{ id: string; name: string; email: string | null; bytes: number; fileCount: number }>
  totalVaultBytes: number
}) {
  if (clients.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-1">Top clientes por almacenamiento</h3>
        <p className="text-xs text-muted-foreground">Aún no hay archivos en la bóveda documental.</p>
      </div>
    )
  }

  const maxBytes = clients[0]?.bytes ?? 1

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Top clientes por almacenamiento</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Uso de bóveda documental por cliente</p>
        </div>
        <Link href="/admin?tab=boveda" className="text-xs text-[#4A6CF7] hover:underline shrink-0">
          Ver documentos →
        </Link>
      </div>
      <div className="space-y-3">
        {clients.map((client, index) => {
          const share = totalVaultBytes > 0 ? Math.round((client.bytes / totalVaultBytes) * 100) : 0
          const barWidth = maxBytes > 0 ? Math.max(4, (client.bytes / maxBytes) * 100) : 0
          return (
            <div key={client.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-secondary text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{client.name}</p>
                    {client.email && (
                      <p className="text-[10px] text-muted-foreground truncate">{client.email}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-foreground tabular-nums">{formatBytes(client.bytes)}</p>
                  <p className="text-[10px] text-muted-foreground">{client.fileCount} archivos · {share}%</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#4A6CF7]/80"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function usageTone(percent: number): {
  bar: string
  text: string
  badge?: string
} {
  if (percent >= 90) {
    return {
      bar: 'bg-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    }
  }
  if (percent >= 75) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    }
  }
  return {
    bar: 'bg-[#4A6CF7]',
    text: 'text-[#4A6CF7]',
  }
}

function UsageCard({
  title,
  icon: Icon,
  usedBytes,
  limitBytes,
  subtitle,
  breakdown,
}: {
  title: string
  icon: React.ElementType
  usedBytes: number
  limitBytes: number
  subtitle?: string
  breakdown?: Array<{ label: string; value: string }>
}) {
  const percent = usagePercent(usedBytes, limitBytes)
  const tone = usageTone(percent)
  const freeBytes = Math.max(0, limitBytes - usedBytes)

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[#4A6CF7]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatBytes(usedBytes)} de {formatBytes(limitBytes)} usados
            </p>
          </div>
        </div>
        <span className={cn('text-lg font-bold tabular-nums shrink-0', tone.text)}>
          {percent}%
        </span>
      </div>

      <div className="space-y-2">
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', tone.bar)}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatBytes(freeBytes)} disponibles</span>
          {percent >= 75 && (
            <span className={cn('inline-flex items-center gap-1 font-medium', tone.text)}>
              <AlertTriangle className="w-3 h-3" />
              {percent >= 90 ? 'Espacio crítico' : 'Espacio limitado'}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{subtitle}</p>
      )}

      {breakdown && breakdown.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {breakdown.map(item => (
            <div
              key={item.label}
              className="rounded-lg bg-secondary/50 border border-border/60 px-3 py-2"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatChip({
  label,
  value,
  sub,
  icon: Icon,
  href,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  href?: string
}) {
  const inner = (
    <div className="rounded-xl bg-secondary/40 border border-border/60 px-3 py-2.5 flex items-center gap-2.5 hover:bg-secondary/70 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#4A6CF7]" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold text-foreground tabular-nums leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/80 truncate">{sub}</p>}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block min-w-0">
        {inner}
      </Link>
    )
  }

  return inner
}

export async function AdminOverview() {
  const data = await getPlatformOverviewAction()

  if (!data) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 text-sm text-muted-foreground">
        No se pudo cargar el resumen de la plataforma.
      </div>
    )
  }

  const { counts, storageBreakdown, health, lastBackup, topVaultClients } = data

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Resumen de la plataforma</h2>
          <p className="text-sm text-muted-foreground">
            Estado del sistema, espacio disponible y accesos rápidos
          </p>
        </div>
        {counts.onlineNow > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 shrink-0">
            <Radio className="w-3.5 h-3.5" />
            {counts.onlineNow} en línea
          </span>
        )}
      </div>

      <SystemHealthPanel status={health.status} alerts={health.alerts} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {data.dbStatsAvailable ? (
          <UsageCard
            title="Base de datos"
            icon={Database}
            usedBytes={data.databaseUsedBytes}
            limitBytes={data.databaseLimitBytes}
            subtitle="Incluye tablas, índices y metadatos de PostgreSQL."
            breakdown={
              data.topTables.length > 0
                ? data.topTables.slice(0, 4).map(t => ({
                    label: t.name,
                    value: `${formatBytes(t.sizeBytes)} · ~${t.rowEstimate.toLocaleString('es-CL')} filas`,
                  }))
                : undefined
            }
          />
        ) : (
          <div className="bg-card border border-amber-500/30 rounded-2xl p-5 space-y-3 shadow-sm lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Base de datos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Límite configurado: {formatBytes(data.databaseLimitBytes)}
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              Ejecuta la migración <code className="text-[11px]">020_admin_platform_db_stats.sql</code> en Supabase
              para ver el uso real de la base de datos y las tablas más pesadas.
            </p>
          </div>
        )}

        <UsageCard
          title="Almacenamiento de archivos"
          icon={HardDrive}
          usedBytes={data.storageUsedBytes}
          limitBytes={data.storageLimitBytes}
          subtitle="Bóveda documental y copias de seguridad en Supabase Storage."
          breakdown={[
            {
              label: 'Bóveda',
              value: `${formatBytes(storageBreakdown.vaultBytes)} · ${storageBreakdown.vaultFiles} archivos`,
            },
            {
              label: 'Backups',
              value: `${formatBytes(storageBreakdown.backupBytes)} · ${storageBreakdown.backupCount} copias`,
            },
          ]}
        />

        <LastBackupCard lastBackup={lastBackup} />
      </div>

      <TopVaultClientsPanel clients={topVaultClients} totalVaultBytes={storageBreakdown.vaultBytes} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatChip
          label="Usuarios totales"
          value={counts.totalUsers}
          sub={`${counts.totalClients} clientes · ${counts.totalSubusers} subusuarios`}
          icon={Users}
          href="/admin?tab=usuarios"
        />
        <StatChip
          label="Cuentas bloqueadas"
          value={counts.blockedAccounts}
          sub={counts.blockedAccounts === 1 ? 'Usuario suspendido' : 'Usuarios suspendidos'}
          icon={Lock}
          href="/admin?tab=usuarios"
        />
        <StatChip
          label="Módulos activos"
          value={counts.activeModules}
          sub={`${counts.totalModules} configurados`}
          icon={Layers}
          href="/admin?tab=usuarios"
        />
        <StatChip
          label="Registros (7d)"
          value={counts.auditLogsWeek}
          sub="Auditoría del sistema"
          icon={ScrollText}
          href="/admin/auditoria"
        />
        <StatChip
          label="Enlaces compartidos"
          value={counts.sharedLinksActive}
          sub="Activos en bóveda"
          icon={Link2}
          href="/admin?tab=boveda"
        />
        <StatChip
          label="Avisos activos"
          value={counts.notificationsActive}
          sub="Notificaciones admin"
          icon={Megaphone}
          href="/admin?tab=notificaciones"
        />
      </div>
    </section>
  )
}

export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 rounded-lg bg-secondary animate-pulse" />
      <div className="h-24 rounded-2xl bg-secondary animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-44 rounded-2xl bg-secondary animate-pulse" />
        <div className="h-44 rounded-2xl bg-secondary animate-pulse" />
        <div className="h-44 rounded-2xl bg-secondary animate-pulse" />
      </div>
      <div className="h-48 rounded-2xl bg-secondary animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    </div>
  )
}
