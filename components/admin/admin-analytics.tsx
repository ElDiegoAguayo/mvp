import {
  Users, LogIn, Activity, Star, FolderOpen, FileSpreadsheet,
  FileText, Package, BarChart3, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUsageAnalyticsAction } from '@/app/admin/usage-analytics-actions'

function KpiCard({
  label, value, sub, icon: Icon, colorClass, bgClass,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  colorClass: string
  bgClass: string
}) {
  return (
    <div className="relative bg-card border border-border rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className={cn('absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 blur-xl', bgClass)} />
      <div className={cn('w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border', bgClass, 'border-current/10')}>
        <Icon className={cn('w-5 h-5', colorClass)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums leading-tight">{value}</p>
        <p className="text-xs sm:text-sm font-medium text-foreground/80 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">{sub}</p>}
      </div>
    </div>
  )
}

function SectionTitle({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-[#4A6CF7]" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 48) return `Hace ${hrs}h`
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
  } catch { return '—' }
}

export async function AdminAnalytics() {
  const data = await getUsageAnalyticsAction()

  if (!data) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
        No se pudieron cargar las métricas de uso.
      </div>
    )
  }

  const maxDaily = Math.max(1, ...data.dailyActiveUsers.map(d => d.count))

  const kpis = [
    {
      label: 'Clientes registrados',
      value: data.totalUsers,
      sub: `${data.activeThisWeek} activos esta semana`,
      icon: Users,
      colorClass: 'text-[#4A6CF7]',
      bgClass: 'bg-[#4A6CF7]/10',
    },
    {
      label: 'Activos hoy',
      value: data.activeToday,
      sub: 'Con actividad en las últimas 24h',
      icon: Activity,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10',
    },
    {
      label: 'Visitas a módulos',
      value: data.moduleViewsWeek,
      sub: data.topModuleGlobal
        ? `Más usado: ${data.topModuleGlobal.name} (${data.topModuleGlobal.views})`
        : 'Últimos 7 días',
      icon: Star,
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10',
    },
    {
      label: 'Bóveda (7d)',
      value: data.vaultEventsWeek,
      sub: 'Subidas + descargas de archivos',
      icon: FolderOpen,
      colorClass: 'text-sky-600 dark:text-sky-400',
      bgClass: 'bg-sky-500/10',
    },
    {
      label: 'Excel + documentos',
      value: data.excelImportsWeek + data.documentsGeneratedWeek,
      sub: `${data.excelImportsWeek} importaciones · ${data.documentsGeneratedWeek} PDF/DOCX`,
      icon: FileSpreadsheet,
      colorClass: 'text-violet-600 dark:text-violet-400',
      bgClass: 'bg-violet-500/10',
    },
    {
      label: 'Alertas inventario',
      value: data.inventoryAlertsNow,
      sub: 'Materiales bajo stock mínimo ahora',
      icon: Package,
      colorClass: 'text-rose-600 dark:text-rose-400',
      bgClass: 'bg-rose-500/10',
    },
    {
      label: 'Logins (7d)',
      value: data.loginsThisWeek,
      sub: 'Inicios de sesión exitosos',
      icon: LogIn,
      colorClass: 'text-indigo-600 dark:text-indigo-400',
      bgClass: 'bg-indigo-500/10',
    },
    {
      label: 'Activos semana',
      value: data.activeThisWeek,
      sub: 'Clientes con actividad registrada',
      icon: TrendingUp,
      colorClass: 'text-teal-600 dark:text-teal-400',
      bgClass: 'bg-teal-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(kpi => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground text-right">Período: últimos 7 días</p>
      </div>

      {/* Weekly active chart */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <SectionTitle title="Usuarios activos por día" icon={BarChart3} />
        <div className="flex items-end gap-2 h-32">
          {data.dailyActiveUsers.map(day => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] font-semibold text-foreground tabular-nums">{day.count}</span>
              <div
                className="w-full rounded-t-md bg-[#4A6CF7]/80 min-h-[4px] transition-all"
                style={{ height: `${Math.max(8, (day.count / maxDaily) * 100)}%` }}
                title={`${day.label}: ${day.count} clientes`}
              />
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top modules */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <SectionTitle title="Módulos más visitados" icon={Star} />
          {data.topModules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin visitas registradas aún. Las visitas se contabilizan al abrir un módulo.</p>
          ) : (
            <div className="space-y-2">
              {data.topModules.map((m, i) => {
                const max = data.topModules[0]?.views ?? 1
                return (
                  <div key={m.moduleName} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-foreground">
                        <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                        {m.moduleName}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{m.views} visitas</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500/70"
                        style={{ width: `${(m.views / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick totals */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <SectionTitle title="Actividad agregada (7d)" icon={Activity} />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Subidas bóveda', value: data.clients.reduce((a, c) => a + c.vaultUploads, 0), icon: FolderOpen },
              { label: 'Descargas bóveda', value: data.clients.reduce((a, c) => a + c.vaultDownloads, 0), icon: FileText },
              { label: 'Importaciones Excel', value: data.excelImportsWeek, icon: FileSpreadsheet },
              { label: 'Docs generados', value: data.documentsGeneratedWeek, icon: FileText },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-secondary/50 border border-border p-3">
                <p className="text-lg font-bold text-foreground tabular-nums">{item.value}</p>
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-client table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <SectionTitle title="Detalle por cliente" icon={Users} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-secondary/40 text-xs text-muted-foreground">
                <th className="text-left p-3 font-semibold">Cliente</th>
                <th className="text-center p-3 font-semibold">Módulo top</th>
                <th className="text-center p-3 font-semibold">Visitas</th>
                <th className="text-center p-3 font-semibold">Bóveda ↑↓</th>
                <th className="text-center p-3 font-semibold">Excel</th>
                <th className="text-center p-3 font-semibold">Docs</th>
                <th className="text-center p-3 font-semibold">Alertas inv.</th>
                <th className="text-right p-3 font-semibold">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">No hay clientes registrados.</td>
                </tr>
              ) : data.clients.map(client => (
                <tr key={client.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="p-3">
                    <p className="font-medium text-foreground truncate max-w-[180px]">{client.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{client.email ?? '—'}</p>
                  </td>
                  <td className="p-3 text-center text-xs text-muted-foreground truncate max-w-[120px]">
                    {client.topModule ?? '—'}
                  </td>
                  <td className="p-3 text-center tabular-nums font-medium">{client.moduleViews}</td>
                  <td className="p-3 text-center tabular-nums text-xs">
                    <span className="text-emerald-600">{client.vaultUploads}</span>
                    <span className="text-muted-foreground mx-0.5">/</span>
                    <span className="text-sky-600">{client.vaultDownloads}</span>
                  </td>
                  <td className="p-3 text-center tabular-nums">{client.excelImports}</td>
                  <td className="p-3 text-center tabular-nums">{client.documentsGenerated}</td>
                  <td className="p-3 text-center">
                    {client.inventoryAlerts > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 border border-rose-500/30">
                        {client.inventoryAlerts}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {client.activeThisWeek ? (
                      <span className="text-emerald-600 font-medium">Activo · </span>
                    ) : null}
                    {formatRelative(client.lastActive)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
