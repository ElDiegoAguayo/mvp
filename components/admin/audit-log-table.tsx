'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Search, Radio, ChevronLeft, ChevronRight, ScrollText, Calendar,
  User as UserIcon, Filter, Undo2, Loader2, ShieldAlert, Download,
  Code2, RefreshCw,
} from 'lucide-react'
import {
  ACTION_LABEL, getActionBadgeClass, getActionRiskLevel, getRiskBadgeClass,
  ACTOR_KIND_LABEL, RISK_LEVEL_LABEL, resolveRowActorKind, getActorKindBadgeClass,
  isHighRiskEvent, type AuditActionType, type AuditActorKind,
  type AuditCategory, type AuditRiskLevel,
} from '@/lib/audit-log'
import { restoreAuditAction } from '@/app/admin/audit-actions'
import { getAuditLogsAction, type AuditLogServerRow } from '@/app/admin/actions'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────────

type AuditLogRow = AuditLogServerRow

interface ActorOption {
  id: string
  full_name: string | null
  email: string | null
  role?: string | null
  parent_user_id?: string | null
}

const PAGE_SIZE = 15

const RESTORABLE_ACTIONS = new Set<AuditActionType>(['DELETE_MODULE', 'BLOCK_USER', 'UNBLOCK_USER', 'UPDATE_PERMISSION'])

type ActionFilter = 'all' | 'creation' | 'update' | 'deletion' | 'restore' | 'system' | 'files' | 'auth'
type RiskFilter   = 'all' | 'low' | 'medium' | 'high' | 'critical'
type CategoryFilter = 'all' | AuditCategory
type ActorKindFilter = 'all' | AuditActorKind

const ACTION_GROUPS: Record<ActionFilter, AuditActionType[]> = {
  all:      [],
  creation: ['CREATE_USER', 'CREATE_MODULE', 'CREATE_DYNAMIC_TABLE', 'CREATE_CHART', 'FOLDER_CREATE', 'FILE_UPLOAD'],
  update:   ['UPDATE_PERMISSION', 'UNBLOCK_USER', 'UPDATE_USER', 'UPDATE_MODULE', 'UPDATE_TABLE_COLUMNS', 'UPDATE_CHART', 'UPDATE_PASSWORD', 'UPDATE_DATA_ACCESS', 'FILE_MOVE', 'BULK_FILE_MOVE'],
  deletion: ['BLOCK_USER', 'DELETE_MODULE', 'DELETE_DYNAMIC_TABLE', 'DELETE_CHART', 'FILE_DELETE', 'FOLDER_DELETE'],
  restore:  ['RESTORE'],
  system:   ['SYSTEM', 'IMPORT_EXCEL'],
  files:    ['FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FILE_MOVE', 'FILE_SHARE', 'BULK_FILE_MOVE', 'FOLDER_CREATE', 'FOLDER_DELETE'],
  auth:     ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED_BY_RATE_LIMIT', 'LOGIN_BLOCKED_IP'],
}

function formatActorLabel(a: ActorOption): string {
  const base = a.full_name || a.email || a.id
  const suffix = a.role === 'admin' ? ' (Admin)' : a.parent_user_id ? ' (Sub)' : a.role === 'user' ? ' (Cliente)' : ''
  return `${base}${suffix}`
}

const FILTER_SELECT_TRIGGER =
  'w-full min-w-0 max-w-full overflow-hidden bg-secondary border-border [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:text-left'

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(iso))
  } catch { return iso }
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Desconocido'
  const l = ua.toLowerCase()
  if (l.includes('windows')) return l.includes('chrome') ? 'Chrome / Windows' : l.includes('firefox') ? 'Firefox / Windows' : 'Windows'
  if (l.includes('mac'))     return l.includes('chrome') ? 'Chrome / macOS'   : l.includes('firefox') ? 'Firefox / macOS'   : 'macOS'
  if (l.includes('linux'))   return 'Linux'
  if (l.includes('android')) return 'Android'
  if (l.includes('iphone'))  return 'iPhone'
  return 'Desconocido'
}

function formatIP(ip: string | null): string {
  if (!ip) return '—'
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.X`
  return ip
}

function isCriticalEvent(log: AuditLogRow): boolean {
  return getActionRiskLevel(log.action_type) === 'critical'
}

function getRowHighlightClass(log: AuditLogRow): string {
  const level = getActionRiskLevel(log.action_type)
  if (level === 'critical') return 'bg-red-500/5 hover:bg-red-500/10 border-l-2 border-l-red-400'
  if (level === 'high') return 'bg-orange-500/5 hover:bg-orange-500/10 border-l-2 border-l-orange-400'
  if (level === 'medium') return 'bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-l-amber-400/60'
  if (isHighRiskEvent(log.action_type, log.actor_kind)) return 'bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-l-amber-400/60'
  return 'hover:bg-secondary/40'
}

function isRestorable(log: AuditLogRow): boolean {
  if (!RESTORABLE_ACTIONS.has(log.action_type as AuditActionType)) return false
  const prev = (log.metadata as { previous_state?: unknown } | null)?.previous_state
  return Boolean(prev && typeof prev === 'object')
}

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ─── Main component ───────────────────────────────────────────────────────────────

export function AuditLogTable() {
  const supabase = useMemo(() => createClient(), [])

  const [rows,      setRows]      = useState<AuditLogRow[]>([])
  const [total,     setTotal]     = useState(0)
  const [actors,    setActors]    = useState<ActorOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [page,      setPage]      = useState(0)

  const [search,       setSearch]       = useState('')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [riskFilter,   setRiskFilter]   = useState<RiskFilter>('all')
  const [actorKindFilter, setActorKindFilter] = useState<ActorKindFilter>('all')
  const [actorFilter,  setActorFilter]  = useState('all')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')

  const debouncedSearch = useDebouncedValue(search, 350)

  // Metadata drawer
  const [metaLog, setMetaLog] = useState<AuditLogRow | null>(null)

  const [restoringId, setRestoringId]   = useState<string | null>(null)
  const [, startTransition]             = useTransition()
  const [isExporting, startExport]      = useTransition()

  // ── Derived filter params ─────────────────────────────────────────────────────
  const actionTypes = actionFilter !== 'all' ? ACTION_GROUPS[actionFilter] : undefined

  // ── Fetch (server-side) ───────────────────────────────────────────────────────
  const fetchPage = useCallback(async () => {
    setIsLoading(true)
    const res = await getAuditLogsAction({
      page,
      pageSize: PAGE_SIZE,
      search:      debouncedSearch || undefined,
      actionTypes: actionTypes?.length ? actionTypes : undefined,
      actorId:     actorFilter !== 'all' ? actorFilter : undefined,
      actorKind:   actorKindFilter !== 'all' ? actorKindFilter : undefined,
      category:    categoryFilter !== 'all' ? categoryFilter : undefined,
      riskLevel:   riskFilter !== 'all' ? riskFilter : undefined,
      dateFrom:    dateFrom || undefined,
      dateTo:      dateTo   || undefined,
    })
    setRows(res.rows)
    setTotal(res.total)
    setIsLoading(false)
  }, [page, debouncedSearch, actionTypes, actorFilter, actorKindFilter, categoryFilter, dateFrom, dateTo, riskFilter])

  useEffect(() => { fetchPage() }, [fetchPage])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, actionFilter, categoryFilter, riskFilter, actorKindFilter, actorFilter, dateFrom, dateTo])

  // ── Load all users for specific-actor filter ────────────────────────────────
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email, role, parent_user_id')
      .order('full_name', { ascending: true })
      .then(({ data }) => setActors((data ?? []) as ActorOption[]))
  }, [supabase])

  // ── Realtime: prepend new rows if on page 0 ───────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        if (page === 0) {
          const row = payload.new as AuditLogRow
          setRows(prev => prev.some(r => r.id === row.id) ? prev : [row, ...prev.slice(0, PAGE_SIZE - 1)])
          setTotal(t => t + 1)
        }
      })
      .subscribe(s => setIsConnected(s === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [supabase, page])

  // ── Restore ───────────────────────────────────────────────────────────────────
  const handleRestore = useCallback((log: AuditLogRow) => {
    if (restoringId) return
    setRestoringId(log.id)
    startTransition(async () => {
      const res = await restoreAuditAction(log.id)
      setRestoringId(null)
      if (res.ok) {
        toast.success('Acción restaurada', { description: res.message })
        fetchPage()
      } else {
        toast.error('No se pudo restaurar', { description: res.message })
      }
    })
  }, [restoringId, fetchPage])

  // ── CSV export (full filtered set, fetches all pages) ─────────────────────────
  const handleExportCSV = () => {
    startExport(async () => {
      const allRes = await getAuditLogsAction({
        pageSize: 10000,
        page: 0,
        search:      debouncedSearch || undefined,
        actionTypes: actionTypes?.length ? actionTypes : undefined,
        actorId:     actorFilter !== 'all' ? actorFilter : undefined,
        actorKind:   actorKindFilter !== 'all' ? actorKindFilter : undefined,
        category:    categoryFilter !== 'all' ? categoryFilter : undefined,
        riskLevel:   riskFilter !== 'all' ? riskFilter : undefined,
        dateFrom:    dateFrom || undefined,
        dateTo:      dateTo   || undefined,
      })

      const headers = ['Fecha', 'Actor', 'Tipo actor', 'Email', 'Riesgo', 'Tipo', 'Descripción', 'Target']
      const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
      const csvRows = allRes.rows.map(l => {
        const kind = resolveRowActorKind(l)
        const risk = getActionRiskLevel(l.action_type)
        return [
          formatDateTime(l.created_at),
          l.actor_name ?? '',
          kind ? ACTOR_KIND_LABEL[kind] : '',
          l.actor_email ?? '',
          RISK_LEVEL_LABEL[risk],
          ACTION_LABEL[l.action_type as AuditActionType] ?? l.action_type,
          l.description,
          l.target_label ?? '',
        ].map(esc).join(',')
      })

      const csv  = [headers.join(','), ...csvRows].join('\n')
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `auditoria-upcrop-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exportados ${allRes.rows.length} eventos`)
    })
  }

  // ── Filter reset ──────────────────────────────────────────────────────────────
  const resetFilters = () => {
    setSearch('')
    setActionFilter('all')
    setCategoryFilter('all')
    setRiskFilter('all')
    setActorKindFilter('all')
    setActorFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters =
    !!search || actionFilter !== 'all' || categoryFilter !== 'all' || riskFilter !== 'all'
    || actorKindFilter !== 'all' || actorFilter !== 'all' || !!dateFrom || !!dateTo
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por usuario, acción, descripción o target..."
              className="pl-9 bg-secondary border-border focus-visible:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Filter className="w-3 h-3 shrink-0" /> Categoría
              </label>
              <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as CategoryFilter)}>
                <SelectTrigger className={FILTER_SELECT_TRIGGER}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="admin">Administración</SelectItem>
                  <SelectItem value="users">Usuarios y permisos</SelectItem>
                  <SelectItem value="files">Archivos (bóveda)</SelectItem>
                  <SelectItem value="auth">Autenticación</SelectItem>
                  <SelectItem value="data">Datos y gráficos</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Filter className="w-3 h-3 shrink-0" /> Tipo de acción
              </label>
              <Select value={actionFilter} onValueChange={v => setActionFilter(v as ActionFilter)}>
                <SelectTrigger className={FILTER_SELECT_TRIGGER}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="files">Archivos (subir/descargar)</SelectItem>
                  <SelectItem value="auth">Login / seguridad</SelectItem>
                  <SelectItem value="creation">Creación</SelectItem>
                  <SelectItem value="update">Actualización</SelectItem>
                  <SelectItem value="deletion">Eliminación / Bloqueo</SelectItem>
                  <SelectItem value="restore">Restauración</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-red-400 shrink-0" /> Nivel de riesgo
              </label>
              <Select value={riskFilter} onValueChange={v => setRiskFilter(v as RiskFilter)}>
                <SelectTrigger className={FILTER_SELECT_TRIGGER}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Bajo</SelectItem>
                  <SelectItem value="medium">Medio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <UserIcon className="w-3 h-3 shrink-0" /> Tipo de actor
              </label>
              <Select value={actorKindFilter} onValueChange={v => setActorKindFilter(v as ActorKindFilter)}>
                <SelectTrigger className={FILTER_SELECT_TRIGGER}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="principal">Clientes</SelectItem>
                  <SelectItem value="sub">Subusuarios</SelectItem>
                  <SelectItem value="anonymous">Anónimos (login)</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <UserIcon className="w-3 h-3 shrink-0" /> Usuario específico
              </label>
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger
                  className={FILTER_SELECT_TRIGGER}
                  title={actorFilter !== 'all' ? formatActorLabel(actors.find(a => a.id === actorFilter) ?? { id: actorFilter, full_name: null, email: null }) : undefined}
                >
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="max-w-[min(24rem,calc(100vw-2rem))]">
                  <SelectItem value="all">Todos</SelectItem>
                  {actors.map(a => (
                    <SelectItem key={a.id} value={a.id} title={formatActorLabel(a)}>
                      <span className="truncate">{formatActorLabel(a)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <label htmlFor="audit-from" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3 shrink-0" /> Desde
              </label>
              <Input id="audit-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full min-w-0 bg-secondary border-border" />
            </div>

            <div className="space-y-1.5 min-w-0">
              <label htmlFor="audit-to" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3 shrink-0" /> Hasta
              </label>
              <Input id="audit-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full min-w-0 bg-secondary border-border" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground hover:text-foreground h-8">
                  Limpiar filtros
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchPage} disabled={isLoading} className="h-8 gap-1.5">
                <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                Actualizar
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={isExporting || total === 0}
              className="h-8 gap-1.5"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/50">
            <div className="flex items-center gap-2">
              <Radio className={cn('w-4 h-4', isConnected ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-xs text-muted-foreground">{isConnected ? 'Conectado en tiempo real' : 'Conectando...'}</span>
              {isConnected && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {total.toLocaleString('es-CL')} {total === 1 ? 'evento' : 'eventos'}
            </span>
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left p-4 font-semibold text-foreground text-xs whitespace-nowrap w-[160px]">Fecha / Hora</th>
                  <th className="text-left p-4 font-semibold text-foreground text-xs w-[180px]">Usuario</th>
                  <th className="text-left p-4 font-semibold text-foreground text-xs w-[140px]">IP / Origen</th>
                  <th className="text-left p-4 font-semibold text-foreground text-xs w-[160px]">Dispositivo</th>
                  <th className="text-left p-4 font-semibold text-foreground text-xs w-[140px]">Tipo de acción</th>
                  <th className="text-left p-4 font-semibold text-foreground text-xs flex-1">Descripción</th>
                  <th className="text-right p-4 font-semibold text-foreground text-xs whitespace-nowrap w-[140px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Cargando registro...</span>
                    </div>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ScrollText className="w-8 h-8 opacity-50" />
                      <p>No hay eventos que coincidan con los filtros.</p>
                    </div>
                  </td></tr>
                ) : rows.map(log => {
                  const isCritical = isCriticalEvent(log)
                  const riskLevel = getActionRiskLevel(log.action_type)
                  const actorKind = resolveRowActorKind(log)
                  return (
                    <tr key={log.id} className={cn(
                      'border-b border-border transition-colors',
                      getRowHighlightClass(log)
                    )}>
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap align-top">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {log.actor_name || (actorKind === 'anonymous' ? 'Anónimo' : '—')}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">{log.actor_email || '—'}</span>
                          {actorKind && (
                            <Badge className={cn(getActorKindBadgeClass(actorKind), 'text-[10px] w-fit font-medium')}>
                              {ACTOR_KIND_LABEL[actorKind]}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <code className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                          {formatIP(log.ip_address ?? null)}
                        </code>
                      </td>
                      <td className="p-4 align-top">
                        <span className="text-xs text-muted-foreground">{parseUserAgent(log.user_agent ?? null)}</span>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isCritical && <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />}
                            <Badge className={cn(getActionBadgeClass(log.action_type as AuditActionType), 'font-medium')}>
                              {ACTION_LABEL[log.action_type as AuditActionType] ?? log.action_type}
                            </Badge>
                          </div>
                          <Badge className={cn(getRiskBadgeClass(riskLevel), 'text-[10px] w-fit font-medium')}>
                            {RISK_LEVEL_LABEL[riskLevel]}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <p className="text-sm text-foreground leading-relaxed">{log.description}</p>
                        {log.target_label && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{log.target_label}</p>
                        )}
                      </td>
                      <td className="p-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Metadata drawer button */}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Ver metadata JSON"
                              onClick={() => setMetaLog(log)}
                            >
                              <Code2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {isRestorable(log) ? (
                            <Button
                              variant="outline" size="sm"
                              disabled={restoringId === log.id}
                              onClick={() => handleRestore(log)}
                              className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground h-7"
                              title="Restaurar al estado anterior"
                            >
                              {restoringId === log.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <><Undo2 className="w-3.5 h-3.5 mr-1" />Restaurar</>
                              }
                            </Button>
                          ) : (
                            !log.metadata || Object.keys(log.metadata).length === 0
                              ? <span className="text-xs text-muted-foreground">—</span>
                              : null
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando registro...
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No hay eventos que coincidan.</div>
            ) : rows.map(log => {
              const isCritical = isCriticalEvent(log)
              const riskLevel = getActionRiskLevel(log.action_type)
              const actorKind = resolveRowActorKind(log)
              return (
                <div key={log.id} className={cn('p-4 space-y-2 border-l-2', getRowHighlightClass(log))}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCritical && <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      <Badge className={cn(getActionBadgeClass(log.action_type as AuditActionType), 'font-medium')}>
                        {ACTION_LABEL[log.action_type as AuditActionType] ?? log.action_type}
                      </Badge>
                      <Badge className={cn(getRiskBadgeClass(riskLevel), 'text-[10px] font-medium')}>
                        {RISK_LEVEL_LABEL[riskLevel]}
                      </Badge>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{formatDateTime(log.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{log.description}</p>
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Por {log.actor_name || (actorKind === 'anonymous' ? 'Anónimo' : '—')}
                      </span>
                      {actorKind && (
                        <Badge className={cn(getActorKindBadgeClass(actorKind), 'text-[10px] font-medium')}>
                          {ACTOR_KIND_LABEL[actorKind]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setMetaLog(log)}>
                          <Code2 className="w-3 h-3" />JSON
                        </Button>
                      )}
                      {isRestorable(log) && (
                        <Button
                          variant="outline" size="sm"
                          disabled={restoringId === log.id}
                          onClick={() => handleRestore(log)}
                          className="border-primary/30 text-primary h-7"
                        >
                          {restoringId === log.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><Undo2 className="w-3.5 h-3.5 mr-1" />Restaurar</>
                          }
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border bg-secondary/30">
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
                <span className="ml-2 text-muted-foreground/60">({total.toLocaleString('es-CL')} total)</span>
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0 || isLoading} onClick={() => setPage(0)}>
                  <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-1" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0 || isLoading} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs px-2 text-muted-foreground">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1 || isLoading} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1 || isLoading} onClick={() => setPage(totalPages - 1)}>
                  <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata JSON drawer */}
      <Dialog open={!!metaLog} onOpenChange={open => !open && setMetaLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#4A6CF7]" />
              Metadata del evento
              {metaLog && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  — {formatDateTime(metaLog.created_at)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {metaLog && (
            <div className="flex-1 overflow-auto">
              <pre className="bg-secondary rounded-xl p-4 text-xs font-mono leading-relaxed text-foreground overflow-auto max-h-[55vh] whitespace-pre-wrap break-all">
                {JSON.stringify(metaLog.metadata, null, 2)}
              </pre>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><span className="font-medium">ID:</span> <code className="font-mono">{metaLog.id}</code></div>
                <div><span className="font-medium">Actor:</span> {metaLog.actor_name || metaLog.actor_email || '—'}</div>
                <div><span className="font-medium">Tipo actor:</span> {(() => { const k = resolveRowActorKind(metaLog); return k ? ACTOR_KIND_LABEL[k] : '—' })()}</div>
                <div><span className="font-medium">Riesgo:</span> {RISK_LEVEL_LABEL[getActionRiskLevel(metaLog.action_type)]}</div>
                <div><span className="font-medium">Target:</span> {metaLog.target_label || metaLog.target_type || '—'}</div>
                <div><span className="font-medium">IP:</span> {metaLog.ip_address || '—'}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
