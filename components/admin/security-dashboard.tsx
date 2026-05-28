'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Shield, LogIn, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  ChevronLeft, ChevronRight, Search, Globe, Monitor, Smartphone,
  Users, Clock, Loader2, ShieldAlert, ShieldX, Activity, Filter,
  Ban, Unlock, MapPin, Trash2, Download,
} from 'lucide-react'
import {
  getLoginStatsAction, getLoginHistoryAction,
  listBlockedIpsAction, blockIpAction, unblockIpAction,
  getCurrentAdminSecurityContextAction, getIpGeolocationsAction,
  type LoginAttemptRow, type LoginStats, type BlockedIpRow,
  type AdminSecurityContext, type IpGeoInfo,
} from '@/app/admin/actions'
import { exportStyledReportExcel } from '@/lib/excel/upcrop-excel-theme'

// ─── Types ────────────────────────────────────────────────────────────────────

const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost|unknown)/i

function isSameIp(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function isAdminOwnIp(ip: string | null | undefined, ctx: AdminSecurityContext | null): boolean {
  if (!ip || !ctx) return false
  if (isSameIp(ip, ctx.sessionIp)) return true
  return ctx.knownIps.some(known => isSameIp(ip, known))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseUserAgent(ua: string): { browser: string; os: string; device: 'desktop' | 'mobile' } {
  const lc = ua.toLowerCase()
  const device: 'desktop' | 'mobile' = /mobile|android|iphone|ipad/.test(lc) ? 'mobile' : 'desktop'
  let browser = 'Navegador desconocido'
  if      (lc.includes('edg/'))   browser = 'Microsoft Edge'
  else if (lc.includes('opr/'))   browser = 'Opera'
  else if (lc.includes('chrome')) browser = 'Chrome'
  else if (lc.includes('firefox'))browser = 'Firefox'
  else if (lc.includes('safari')) browser = 'Safari'
  else if (lc.includes('trident'))browser = 'Internet Explorer'
  let os = 'SO desconocido'
  if      (lc.includes('windows nt 10')) os = 'Windows 10/11'
  else if (lc.includes('windows nt'))    os = 'Windows'
  else if (lc.includes('mac os x'))      os = 'macOS'
  else if (lc.includes('iphone'))        os = 'iOS (iPhone)'
  else if (lc.includes('ipad'))          os = 'iOS (iPad)'
  else if (lc.includes('android'))       os = 'Android'
  else if (lc.includes('linux'))         os = 'Linux'
  return { browser, os, device }
}

function formatRelative(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Hace un momento'
  if (mins < 60)  return `Hace ${mins} min`
  if (hours < 24) return `Hace ${hours}h`
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PAGE_SIZE = 20

// ─── Geo display ──────────────────────────────────────────────────────────────

function GeoTag({ ip, geoMap }: { ip: string | null; geoMap: Record<string, IpGeoInfo | null> }) {
  if (!ip) return null

  if (PRIVATE_IP_RE.test(ip)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground italic">
        <MapPin className="w-2.5 h-2.5 shrink-0" />
        Red local (sin geolocalización)
      </span>
    )
  }

  const geo = geoMap[ip]
  if (geo === undefined) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Loader2 className="w-2.5 h-2.5 animate-spin shrink-0" />
        Consultando ubicación...
      </span>
    )
  }

  if (!geo) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground italic">
        <MapPin className="w-2.5 h-2.5 shrink-0" />
        Ubicación no disponible
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-normal">
      <MapPin className="w-2.5 h-2.5 shrink-0" />
      {geo.city ? `${geo.city}, ` : ''}{geo.country}
      {geo.countryCode ? ` (${geo.countryCode})` : ''}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, colorClass, bgClass }: {
  label: string; value: number | string; sub: string
  icon: React.ElementType; colorClass: string; bgClass: string
}) {
  return (
    <div className={cn('rounded-xl border border-border p-4 flex items-center gap-3 relative overflow-hidden', bgClass)}>
      <div className={cn('absolute -right-3 -top-3 w-16 h-16 rounded-full opacity-15 blur-xl', bgClass)} />
      <Icon className={cn('w-5 h-5 shrink-0', colorClass)} />
      <div>
        <p className={cn('text-xl font-bold', colorClass)}>{value}</p>
        <p className="text-xs font-medium text-foreground/80">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

function BruteForceAlerts({
  alerts, onBlock, adminContext, geoMap,
}: {
  alerts: LoginStats['bruteForceAlerts']
  onBlock: (ip: string) => void
  adminContext: AdminSecurityContext | null
  geoMap: Record<string, IpGeoInfo | null>
}) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          No se detectaron patrones de fuerza bruta en la última hora.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <ShieldX className="w-4 h-4 text-rose-500" />
        <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          {alerts.length} alerta{alerts.length !== 1 ? 's' : ''} de actividad sospechosa (última hora)
        </span>
      </div>
      {alerts.map(alert => (
        <div
          key={`${alert.email}::${alert.ip_address}`}
          className={cn(
            'flex items-start gap-3 p-3 rounded-xl border',
            alert.isCurrentlyBlocked
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          )}
        >
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            alert.isCurrentlyBlocked ? 'bg-rose-500/20' : 'bg-amber-500/20'
          )}>
            {alert.isCurrentlyBlocked
              ? <ShieldX className="w-4 h-4 text-rose-500" />
              : <AlertTriangle className="w-4 h-4 text-amber-500" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{alert.email}</span>
              {alert.isCurrentlyBlocked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  BLOQUEADO (cuenta)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1 flex-wrap">
                <Globe className="w-3 h-3" />
                {alert.ip_address || '—'}
                {alert.ip_address && <GeoTag ip={alert.ip_address} geoMap={geoMap} />}
              </span>
              <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-rose-500" />{alert.failCount} intentos fallidos</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelative(alert.lastAttempt)}</span>
            </div>
          </div>
          {alert.ip_address && !isAdminOwnIp(alert.ip_address, adminContext) && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-8 gap-1.5 text-xs border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white"
              onClick={() => onBlock(alert.ip_address)}
            >
              <Ban className="w-3.5 h-3.5" />
              Bloquear IP
            </Button>
          )}
          {alert.ip_address && isAdminOwnIp(alert.ip_address, adminContext) && (
            <span className="shrink-0 text-[10px] text-muted-foreground italic px-2">Tu IP</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Blocked IPs List ─────────────────────────────────────────────────────────

function BlockedIpsList({
  blockedIps, isLoading, onUnblock, geoMap,
}: {
  blockedIps: BlockedIpRow[]
  isLoading: boolean
  onUnblock: (ip: string) => void
  geoMap: Record<string, IpGeoInfo | null>
}) {
  if (isLoading) {
    return <div className="h-14 rounded-lg bg-secondary animate-pulse" />
  }

  if (blockedIps.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 border border-border">
        <Unlock className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No hay IPs bloqueadas manualmente.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blockedIps.map(row => (
        <div key={row.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/8 border border-rose-500/20">
          <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0">
            <Ban className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm font-mono font-semibold text-foreground">{row.ip_address}</code>
              <GeoTag ip={row.ip_address} geoMap={geoMap} />
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
              {row.reason && <span>"{row.reason}"</span>}
              <span><Clock className="w-3 h-3 inline mr-0.5" />{formatRelative(row.created_at)}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 h-8 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
            onClick={() => onUnblock(row.ip_address)}
          >
            <Unlock className="w-3.5 h-3.5" />
            Desbloquear
          </Button>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SecurityDashboard() {
  const [stats,      setStats]      = useState<LoginStats | null>(null)
  const [history,    setHistory]    = useState<LoginAttemptRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(0)
  const [emailFilter, setEmailFilter] = useState('')
  const [onlyFailed,  setOnlyFailed]  = useState(false)
  const [loadingStats,   setLoadingStats]   = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Blocked IPs
  const [blockedIps,    setBlockedIps]    = useState<BlockedIpRow[]>([])
  const [loadingBlocked, setLoadingBlocked] = useState(true)
  const [blockTarget,   setBlockTarget]   = useState<string | null>(null)
  const [blockReason,   setBlockReason]   = useState('')
  const [confirmUnblock, setConfirmUnblock] = useState<string | null>(null)
  const [adminContext, setAdminContext]     = useState<AdminSecurityContext | null>(null)
  const [geoMap, setGeoMap]                 = useState<Record<string, IpGeoInfo | null>>({})
  const geoMapRef = useRef(geoMap)
  geoMapRef.current = geoMap

  const [isPending, startTransition] = useTransition()
  const [isBlocking, startBlock]     = useTransition()
  const [isExporting, startExport]   = useTransition()

  const loadGeoForIps = useCallback(async (ips: string[]) => {
    const toFetch = ips.filter(
      ip => ip && geoMapRef.current[ip] === undefined && !PRIVATE_IP_RE.test(ip)
    )
    if (toFetch.length === 0) return
    const result = await getIpGeolocationsAction(toFetch)
    setGeoMap(prev => ({ ...prev, ...result }))
  }, [])

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    const data = await getLoginStatsAction()
    setStats(data)
    setLoadingStats(false)
  }, [])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    const res = await getLoginHistoryAction({ page, pageSize: PAGE_SIZE, email: emailFilter, onlyFailed })
    setHistory(res.rows)
    setTotal(res.total)
    setLoadingHistory(false)
  }, [page, emailFilter, onlyFailed])

  const loadBlocked = useCallback(async () => {
    setLoadingBlocked(true)
    const rows = await listBlockedIpsAction()
    setBlockedIps(rows)
    setLoadingBlocked(false)
  }, [])

  useEffect(() => { loadStats() },   [loadStats])
  useEffect(() => { loadHistory() }, [loadHistory])
  useEffect(() => { loadBlocked() }, [loadBlocked])

  useEffect(() => {
    getCurrentAdminSecurityContextAction().then(setAdminContext)
  }, [])

  useEffect(() => { setPage(0) }, [emailFilter, onlyFailed])

  // Resolve geolocation server-side for visible IPs
  useEffect(() => {
    const ips = [
      ...history.map(r => r.ip_address),
      ...(stats?.bruteForceAlerts.map(a => a.ip_address) ?? []),
      ...blockedIps.map(b => b.ip_address),
    ].filter(Boolean) as string[]
    loadGeoForIps([...new Set(ips)])
  }, [history, stats, blockedIps, loadGeoForIps])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function handleRefresh() {
    startTransition(() => { loadStats(); loadHistory(); loadBlocked() })
  }

  function handleBlockIp(ip: string) {
    if (ip && isAdminOwnIp(ip, adminContext)) {
      toast.error('No puedes bloquear tu propia IP.')
      return
    }
    setBlockTarget(ip)
    setBlockReason('')
  }

  function confirmBlockIp() {
    if (!blockTarget?.trim()) return
    const ip = blockTarget.trim()
    if (isAdminOwnIp(ip, adminContext)) {
      toast.error('No puedes bloquear tu propia IP.')
      return
    }
    const reason = blockReason.trim() || undefined
    setBlockTarget(null)
    startBlock(async () => {
      const res = await blockIpAction(ip, reason)
      if (res.ok) {
        toast.success(res.message)
        loadBlocked()
        loadStats()
      } else {
        toast.error(res.message)
      }
    })
  }

  function handleUnblockIp(ip: string) {
    setConfirmUnblock(ip)
  }

  function confirmUnblockIp() {
    if (!confirmUnblock) return
    const ip = confirmUnblock
    setConfirmUnblock(null)
    startBlock(async () => {
      const res = await unblockIpAction(ip)
      if (res.ok) {
        toast.success(res.message)
        setBlockedIps(prev => prev.filter(r => r.ip_address !== ip))
      } else {
        toast.error(res.message)
      }
    })
  }

  function handleExportExcel() {
    startExport(async () => {
      const res = await getLoginHistoryAction({
        page: 0,
        pageSize: 10000,
        email: emailFilter || undefined,
        onlyFailed: onlyFailed || undefined,
      })

      const ips = [...new Set(res.rows.map(r => r.ip_address).filter(Boolean) as string[])]
      const geo = ips.length > 0 ? await getIpGeolocationsAction(ips) : {}

      const headers = ['Estado', 'Nombre', 'Email', 'IP', 'País', 'Ciudad', 'Navegador', 'SO', 'Fecha']
      const excelRows = res.rows.map((row) => {
        const { browser, os } = parseUserAgent(row.user_agent ?? '')
        const g = row.ip_address ? geo[row.ip_address] : null
        return [
          row.success ? 'Exitoso' : 'Fallido',
          row.full_name ?? '',
          row.email,
          row.ip_address ?? '',
          g?.country ?? '',
          g?.city ?? '',
          browser,
          os,
          formatDateTime(row.attempted_at),
        ]
      })

      const failed = res.rows.filter((r) => !r.success).length

      await exportStyledReportExcel({
        sheetName: 'Accesos',
        title: 'HISTORIAL DE ACCESOS',
        moduleLabel: 'Administración — Seguridad',
        filename: `seguridad-logins-${new Date().toISOString().slice(0, 10)}.xlsx`,
        headers,
        rows: excelRows,
        instructions: [
          '1. Revise intentos fallidos y accesos desde IPs o ubicaciones inusuales.',
          '2. La columna Estado indica si el inicio de sesión fue exitoso o rechazado.',
          '3. Use Navegador y SO para detectar dispositivos no reconocidos.',
        ],
        summary: `Resumen: ${res.rows.length} registro${res.rows.length !== 1 ? 's' : ''} · ${failed} fallido${failed !== 1 ? 's' : ''}${emailFilter ? ` · Email: ${emailFilter}` : ''}${onlyFailed ? ' · Solo fallidos' : ''}`,
        columnWidths: [12, 18, 24, 16, 14, 16, 16, 14, 18],
      })

      toast.success(`Exportados ${res.rows.length} registros`)
    })
  }

  return (
    <>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#4A6CF7]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Seguridad</h2>
              <p className="text-xs text-muted-foreground">Historial de accesos y detección de amenazas</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isPending || loadingStats} className="gap-1.5 h-8">
            <RefreshCw className={cn('w-3.5 h-3.5', (isPending || loadingStats) && 'animate-spin')} />
            Actualizar
          </Button>
        </div>

        {/* KPI Cards */}
        {loadingStats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-secondary animate-pulse" />)}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Logins hoy" value={stats.loginsToday} sub="Accesos exitosos" icon={LogIn} colorClass="text-emerald-600 dark:text-emerald-400" bgClass="bg-emerald-500/10" />
            <KpiCard label="Usuarios únicos hoy" value={stats.uniqueUsersToday} sub="Emails distintos" icon={Users} colorClass="text-[#4A6CF7]" bgClass="bg-[#4A6CF7]/10" />
            <KpiCard label="Fallos hoy" value={stats.failedToday} sub="Intentos fallidos" icon={XCircle} colorClass="text-amber-600 dark:text-amber-400" bgClass="bg-amber-500/10" />
            <KpiCard
              label="Fallos última hora"
              value={stats.failedThisHour}
              sub={stats.failedThisHour >= 5 ? '⚠ Posible ataque' : 'Sin anomalías'}
              icon={stats.failedThisHour >= 5 ? ShieldAlert : Activity}
              colorClass={stats.failedThisHour >= 5 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}
              bgClass={stats.failedThisHour >= 5 ? 'bg-rose-500/10' : 'bg-secondary/60'}
            />
          </div>
        )}

        {/* Brute force section */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-[#4A6CF7]" />
            <h3 className="text-sm font-semibold text-foreground">Detección de fuerza bruta</h3>
            <span className="text-xs text-muted-foreground ml-1">(3+ fallos en 60 min desde la misma IP)</span>
          </div>
          {loadingStats
            ? <div className="h-14 rounded-lg bg-secondary animate-pulse" />
            : <BruteForceAlerts alerts={stats?.bruteForceAlerts ?? []} onBlock={handleBlockIp} adminContext={adminContext} geoMap={geoMap} />
          }
        </div>

        {/* Blocked IPs */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-foreground">IPs bloqueadas manualmente</h3>
              {blockedIps.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  {blockedIps.length}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => handleBlockIp('')}>
              <Ban className="w-3 h-3" />
              Bloquear IP
            </Button>
          </div>
          <BlockedIpsList blockedIps={blockedIps} isLoading={loadingBlocked} onUnblock={handleUnblockIp} geoMap={geoMap} />
        </div>

        {/* Login history table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border bg-secondary/30 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={emailFilter}
                onChange={e => setEmailFilter(e.target.value)}
                placeholder="Filtrar por email..."
                className="pl-8 h-8 text-sm bg-background"
              />
            </div>
            <Button
              variant={onlyFailed ? 'default' : 'outline'}
              size="sm"
              className={cn('h-8 gap-1.5 text-xs', onlyFailed && 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600')}
              onClick={() => setOnlyFailed(v => !v)}
            >
              <Filter className="w-3.5 h-3.5" />
              Solo fallidos
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleExportExcel}
              disabled={isExporting || total === 0}
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Exportar Excel
            </Button>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              {total.toLocaleString('es-CL')} registros
            </span>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cargando historial...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Shield className="w-10 h-10 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">No hay registros para los filtros seleccionados.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuario</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">IP / Ubicación</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Navegador / SO</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[90px]">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((row, idx) => {
                      const { browser, os, device } = parseUserAgent(row.user_agent ?? '')
                      const DeviceIcon = device === 'mobile' ? Smartphone : Monitor
                      const isBlocked = blockedIps.some(b => b.ip_address === row.ip_address)
                      const isOwnIp   = isAdminOwnIp(row.ip_address, adminContext)

                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            'transition-colors hover:bg-secondary/40',
                            !row.success && 'bg-rose-500/5 hover:bg-rose-500/10',
                            row.success && idx % 2 === 0 && 'bg-secondary/10'
                          )}
                        >
                          <td className="px-5 py-3">
                            {row.success ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />Exitoso
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                <XCircle className="w-3 h-3" />Fallido
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {row.full_name && <p className="text-xs font-semibold text-foreground">{row.full_name}</p>}
                            <p className="text-xs text-muted-foreground">{row.email}</p>
                          </td>
                          <td className="px-5 py-3">
                            <div>
                              <div className="flex items-center gap-1.5">
                                {isBlocked && <Ban className="w-3 h-3 text-rose-500 shrink-0" title="IP bloqueada" />}
                                <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                                <code className="text-xs font-mono text-foreground/80">{row.ip_address || '—'}</code>
                              </div>
                              {row.ip_address && <GeoTag ip={row.ip_address} geoMap={geoMap} />}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <DeviceIcon className="w-3.5 h-3.5 shrink-0" />
                              <div>
                                <p className="text-foreground/80 font-medium">{browser}</p>
                                <p className="text-[10px]">{os}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-xs text-foreground/80">{formatDateTime(row.attempted_at)}</p>
                            <p className="text-[10px] text-muted-foreground">{formatRelative(row.attempted_at)}</p>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {row.ip_address && !isBlocked && !isOwnIp ? (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                                title="Bloquear esta IP"
                                onClick={() => handleBlockIp(row.ip_address!)}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </Button>
                            ) : row.ip_address && isBlocked ? (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-rose-500 hover:text-emerald-500"
                                title="Desbloquear IP"
                                onClick={() => handleUnblockIp(row.ip_address!)}
                              >
                                <Unlock className="w-3.5 h-3.5" />
                              </Button>
                            ) : isOwnIp ? (
                              <span className="text-[10px] text-muted-foreground italic">Tu IP</span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
                  <p className="text-xs text-muted-foreground">
                    Filas <span className="font-semibold text-foreground">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</span> de <span className="font-semibold text-foreground">{total.toLocaleString('es-CL')}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(0)} disabled={page === 0 || loadingHistory}>
                      <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-1" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => p - 1)} disabled={page === 0 || loadingHistory}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1 || loadingHistory}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1 || loadingHistory}>
                      <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Block IP dialog */}
      <AlertDialog open={blockTarget !== null} onOpenChange={open => { if (!open) setBlockTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-500" />
              Bloquear IP{blockTarget ? `: ${blockTarget}` : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta IP será registrada como bloqueada. Los intentos de login desde esta IP quedarán en el historial pero el sistema puede usarla para auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 my-2">
            {blockTarget === '' && (
              <div>
                <label className="text-xs font-medium text-foreground">Dirección IP</label>
                <Input
                  placeholder="ej. 123.456.789.0"
                  className="mt-1 h-9"
                  value={blockTarget ?? ''}
                  onChange={e => setBlockTarget(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-foreground">Razón (opcional)</label>
              <Input
                placeholder="ej. Actividad sospechosa detectada"
                className="mt-1 h-9"
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBlockIp}
              disabled={isBlocking || !blockTarget?.trim() || isAdminOwnIp(blockTarget.trim(), adminContext)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isBlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Ban className="w-3.5 h-3.5 mr-1" />}
              Bloquear IP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock confirm dialog */}
      <AlertDialog open={!!confirmUnblock} onOpenChange={open => { if (!open) setConfirmUnblock(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-500" />
              Desbloquear IP
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Desbloquear la IP <code className="font-mono font-semibold">{confirmUnblock}</code>? Podrá volver a hacer solicitudes normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnblockIp}
              disabled={isBlocking}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isBlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
