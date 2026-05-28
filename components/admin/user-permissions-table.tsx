'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  User,
  Loader2,
  Radio,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  ShieldAlert,
  Shield,
  Plus,
  Trash2,
  Pencil,
  Database,
  UserPlus,
  ListOrdered,
  Clock,
  Eye,
} from 'lucide-react'
import { getModuleIcon, getIconShape, resolveIconContainerStyle, resolveIconStyle, resolveTextStyle } from '@/lib/module-icons'
import { cn } from '@/lib/utils'
import { exportStyledReportExcel } from '@/lib/excel/upcrop-excel-theme'
import { CreateModuleDialog } from './create-module-dialog'
import { EditModuleDialog } from './edit-module-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { UserDataAccessDialog } from './user-data-access-dialog'
import { CreateSubuserDialog } from './create-subuser-dialog'
import { ModuleOrderDialog } from './module-order-dialog'
import { logAudit } from '@/lib/audit-log'
import { startImpersonationAction } from '@/app/admin/impersonation-actions'

interface ModuleRow {
  id: string
  slug: string
  name: string
  icon: string
  color?: string | null
  text_color?: string | null
  icon_shape?: string | null
  description: string | null
  is_active: boolean
  is_core?: boolean
  embed_url?: string | null
}

interface AccessRow {
  user_id: string
  module_id: string
  enabled: boolean
  display_order: number | null
}

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
  role: string
  created_at: string
  is_active: boolean
  last_activity_at: string | null
  parent_user_id: string | null
  avatar_url?: string | null
}

const PAGE_SIZE = 10

type FilterValue = 'all' | 'blocked' | 'admins' | 'clients' | 'principal' | 'sub'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

function isUserOnline(iso: string | null): boolean {
  if (!iso) return false
  try {
    return Date.now() - new Date(iso).getTime() < ONLINE_THRESHOLD_MS
  } catch {
    return false
  }
}

function formatTimeAgo(iso: string | null) {
  if (!iso) return null
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const totalMins = Math.floor(diff / 60000)
    if (totalMins < 1) return 'Ahora mismo'
    if (totalMins < 60) return `Hace ${totalMins} min`
    const totalHrs = Math.floor(totalMins / 60)
    if (totalHrs < 24) return `Hace ${totalHrs}h`
    const days = Math.floor(totalHrs / 24)
    const remHrs = totalHrs % 24
    if (remHrs > 0) return `Hace ${days}d ${remHrs}h`
    return `Hace ${days}d`
  } catch {
    return '—'
  }
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function UserTablePagination({
  safePage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}: {
  safePage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
}) {
  if (totalItems === 0 || totalPages <= 1) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-secondary/30 shrink-0">
      <p className="text-xs text-muted-foreground">
        Mostrando{' '}
        <span className="text-foreground font-medium">{(safePage - 1) * pageSize + 1}</span>
        {'–'}
        <span className="text-foreground font-medium">
          {Math.min(safePage * pageSize, totalItems)}
        </span>{' '}
        de <span className="text-foreground font-medium">{totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="h-8 border-border gap-1"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        {Array.from({ length: totalPages }).map((_, i) => {
          const pageNum = i + 1
          if (
            totalPages > 7 &&
            Math.abs(pageNum - safePage) > 2 &&
            pageNum !== 1 &&
            pageNum !== totalPages
          ) {
            if (pageNum === 2 || pageNum === totalPages - 1) {
              return (
                <span key={pageNum} className="px-1.5 text-muted-foreground">
                  …
                </span>
              )
            }
            return null
          }
          return (
            <Button
              key={pageNum}
              size="sm"
              variant={pageNum === safePage ? 'default' : 'outline'}
              onClick={() => onPageChange(pageNum)}
              className={
                pageNum === safePage
                  ? 'h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'h-8 w-8 p-0 border-border'
              }
            >
              {pageNum}
            </Button>
          )
        })}
        <Button
          size="sm"
          variant="outline"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className="h-8 border-border gap-1"
          aria-label="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export function UserPermissionsTable() {
  const supabase = useMemo(() => createClient(), [])

  const [users, setUsers] = useState<UserRow[]>([])
  const [modules, setModules] = useState<ModuleRow[]>([])
  // Permissions keyed by `${userId}:${moduleId}` -> boolean
  const [access, setAccess] = useState<Record<string, boolean>>({})
  const [accessOrder, setAccessOrder] = useState<Record<string, number>>({})

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [blockingStates, setBlockingStates] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [filter, setFilter] = useState<FilterValue>('all')
  const [page, setPage] = useState(1)

  const [blockTarget, setBlockTarget] = useState<UserRow | null>(null)
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [editModuleTarget, setEditModuleTarget] = useState<ModuleRow | null>(null)
  const [deleteModuleTarget, setDeleteModuleTarget] = useState<ModuleRow | null>(null)
  const [isDeletingModule, setIsDeletingModule] = useState(false)
  const [editUserTarget, setEditUserTarget] = useState<UserRow | null>(null)
  const [dataAccessTarget, setDataAccessTarget] = useState<UserRow | null>(null)
  const [subuserTarget, setSubuserTarget] = useState<UserRow | null>(null)
  const [orderTarget, setOrderTarget] = useState<UserRow | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  // Ticker to force re-render every 30s so relative times stay fresh
  const [, setTick] = useState(0)

  const accessKey = (userId: string, moduleId: string) => `${userId}:${moduleId}`

  const fetchAll = useCallback(async () => {
    // Fetch users and access normally
    const [usersRes, accessRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, full_name, email, role, created_at, is_active, last_activity_at, parent_user_id, avatar_url',
        )
        .order('created_at', { ascending: false }),
      supabase.from('user_module_access').select('user_id, module_id, enabled, display_order'),
    ])

    // Resilient modules fetch (supports missing is_core column during migration)
    let modulesRes: any = { data: [], error: null }
    try {
      const resWithCore = await supabase
        .from('modules')
        .select('id, slug, name, icon, color, text_color, icon_shape, description, is_active, is_core, embed_url')
          .eq('is_active', true)
          .order('created_at', { ascending: true })

      if (!resWithCore.error) {
        modulesRes = resWithCore
      } else {
        // Fallback: try without is_core
        const res2 = await supabase
          .from('modules')
          .select('id, slug, name, icon, color, text_color, icon_shape, description, is_active, embed_url')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
        if (!res2.error) {
          modulesRes = res2
        } else {
          // Fallback: try without new color columns (pre-migration)
          const res3 = await supabase
            .from('modules')
            .select('id, slug, name, icon, description, is_active, embed_url')
            .eq('is_active', true)
            .order('created_at', { ascending: true })
          modulesRes = res3
        }
      }
    } catch {
      // Last resort: bare minimum columns
      modulesRes = await supabase
        .from('modules')
        .select('id, slug, name, icon, description, is_active, embed_url')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
    }

    if (usersRes.error) console.error('[v0] users error:', usersRes.error)
    if (modulesRes.error) console.error('[v0] modules error:', modulesRes.error)
    if (accessRes.error) console.error('[v0] access error:', accessRes.error)

    setUsers((usersRes.data ?? []) as UserRow[])
    setModules(((modulesRes.data ?? []) as ModuleRow[]).filter(m => m.slug !== 'inicio'))


    const map: Record<string, boolean> = {}
    const orderMap: Record<string, number> = {}
    ;((accessRes.data ?? []) as AccessRow[]).forEach((row) => {
      const key = accessKey(row.user_id, row.module_id)
      map[key] = !!row.enabled
      orderMap[key] = row.display_order ?? 0
    })
    setAccess(map)
    setAccessOrder(orderMap)
    setIsLoading(false)
  }, [supabase])

  // Initial load + realtime
  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel('admin-users-modules-access')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload) => {
          const newUser = payload.new as UserRow
          setUsers((prev) =>
            prev.some((u) => u.id === newUser.id) ? prev : [newUser, ...prev],
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as UserRow
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'profiles' },
        (payload) => {
          const removed = payload.old as { id: string }
          setUsers((prev) => prev.filter((u) => u.id !== removed.id))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'modules' },
        async () => {
          // Try full columns first, progressively degrade if columns missing
          const { data: d1, error: e1 } = await supabase
            .from('modules')
            .select('id, slug, name, icon, color, text_color, icon_shape, description, is_active, is_core, embed_url')
            .eq('is_active', true).order('created_at', { ascending: true })
          if (!e1) { setModules((d1 as ModuleRow[]).filter(m => m.slug !== 'inicio')); return }

          const { data: d2, error: e2 } = await supabase
            .from('modules')
            .select('id, slug, name, icon, color, text_color, icon_shape, description, is_active, embed_url')
            .eq('is_active', true).order('created_at', { ascending: true })
          if (!e2) { setModules((d2 as ModuleRow[]).filter(m => m.slug !== 'inicio')); return }

          const { data: d3 } = await supabase
            .from('modules')
            .select('id, slug, name, icon, description, is_active, embed_url')
            .eq('is_active', true).order('created_at', { ascending: true })
          setModules(((d3 ?? []) as ModuleRow[]).filter(m => m.slug !== 'inicio'))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_module_access' },
        (payload) => {
          const row = (payload.new ?? payload.old) as AccessRow | undefined
          if (!row?.user_id || !row.module_id) return
          const key = accessKey(row.user_id, row.module_id)
          setAccess((prev) => {
            const next = { ...prev }
            if (payload.eventType === 'DELETE') {
              delete next[key]
            } else {
              next[key] = !!(payload.new as AccessRow).enabled
            }
            return next
          })
          setAccessOrder((prev) => {
            const next = { ...prev }
            if (payload.eventType === 'DELETE') {
              delete next[key]
            } else {
              next[key] = (payload.new as AccessRow).display_order ?? 0
            }
            return next
          })
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchAll])

  // Refresh relative times every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const handleViewAsClient = useCallback((user: UserRow) => {
    if (user.role !== 'user' || !user.is_active || impersonatingId) return
    setImpersonatingId(user.id)
    startTransition(async () => {
      const res = await startImpersonationAction(user.id)
      if (res && !res.ok) {
        toast.error('No se pudo iniciar modo soporte', { description: res.message })
        setImpersonatingId(null)
      }
      // redirect() on success — no cleanup needed
    })
  }, [impersonatingId, startTransition])

  const handleAccessChange = async (
    userId: string,
    moduleId: string,
    checked: boolean,
  ) => {
    // Core modules cannot be toggled
    const module = modules.find((m) => m.id === moduleId)
    if (module?.is_core) return

    const key = accessKey(userId, moduleId)
    const previous = !!access[key]
    setLoadingStates((prev) => ({ ...prev, [key]: true }))
    // Optimistic UI - we trust the visual change unless DB errors out.
    setAccess((prev) => ({ ...prev, [key]: checked }))

    const { error } = await supabase.from('user_module_access').upsert(
      {
        user_id: userId,
        module_id: moduleId,
        enabled: checked,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,module_id' },
    )

    setLoadingStates((prev) => ({ ...prev, [key]: false }))

    if (error) {
      // Revert and notify only on failure - no success toasts (anti-spam).
      setAccess((prev) => ({ ...prev, [key]: previous }))
      toast.error('No se pudieron actualizar los permisos', {
        description: error.message,
      })
      return
    }

    const user = users.find((u) => u.id === userId)
    const moduleObj = modules.find((m) => m.id === moduleId)
    const userLabel = user?.full_name || user?.email || 'usuario'
    const moduleLabel = moduleObj?.name ?? 'módulo'
    logAudit(supabase, {
      action_type: 'UPDATE_PERMISSION',
      target_type: 'user_module_access',
      target_id: userId,
      target_label: `${userLabel} / ${moduleLabel}`,
      description: `${checked ? 'Activó' : 'Desactivó'} el módulo "${moduleLabel}" para ${userLabel} (${user?.email ?? ''}).`,
      metadata: {
        user_id: userId,
        module_id: moduleId,
        enabled: checked,
        previous_state: {
          user_id: userId,
          module_id: moduleId,
          enabled: previous,
        },
      },
    })
  }

  const toggleBlock = async (user: UserRow) => {
    const newStatus = !user.is_active
    setBlockingStates((prev) => ({ ...prev, [user.id]: true }))

    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u)),
    )

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: user.is_active } : u)),
      )
      toast.error('No se pudo actualizar el estado del usuario', {
        description: error.message,
      })
    } else {
      toast.success(
        newStatus ? 'Usuario desbloqueado' : 'Usuario bloqueado',
        {
          description: newStatus
            ? `${user.full_name || user.email} podrá iniciar sesión nuevamente.`
            : `${user.full_name || user.email} no podrá iniciar sesión hasta ser reactivado.`,
        },
      )
      const userLabel = user.full_name || user.email || 'usuario'
      logAudit(supabase, {
        action_type: newStatus ? 'UNBLOCK_USER' : 'BLOCK_USER',
        target_type: 'user',
        target_id: user.id,
        target_label: user.email ?? userLabel,
        description: newStatus
          ? `Desbloqueó la cuenta de ${userLabel} (${user.email ?? ''}).`
          : `Bloqueó la cuenta de ${userLabel} (${user.email ?? ''}).`,
        metadata: {
          previous_state: {
            user_id: user.id,
            is_active: user.is_active,
          },
        },
      })
    }

    setBlockingStates((prev) => ({ ...prev, [user.id]: false }))
    setBlockTarget(null)
  }

  const handleBlockClick = (user: UserRow) => {
    if (user.is_active) setBlockTarget(user)
    else toggleBlock(user)
  }

  const handleDeleteModule = async () => {
    if (!deleteModuleTarget) return
    setIsDeletingModule(true)

    const moduleId = deleteModuleTarget.id
    const moduleName = deleteModuleTarget.name

    // Capture FULL previous state (module row + all access rows) before deletion
    // so the entry can be restored later via the "Deshacer" action.
    const [moduleSnapshotRes, accessSnapshotRes] = await Promise.all([
      supabase.from('modules').select('*').eq('id', moduleId).single(),
      supabase
        .from('user_module_access')
        .select('user_id, module_id, enabled, updated_at')
        .eq('module_id', moduleId),
    ])

    // Optimistic UI: remove column immediately and clean any access keys.
    setModules((prev) => prev.filter((m) => m.id !== moduleId))
    setAccess((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((key) => {
        if (key.endsWith(`:${moduleId}`)) delete next[key]
      })
      return next
    })

    // ON DELETE CASCADE on user_module_access cleans up access rows in DB.
    const { error } = await supabase.from('modules').delete().eq('id', moduleId)

    setIsDeletingModule(false)
    setDeleteModuleTarget(null)

    if (error) {
      toast.error('No se pudo eliminar el módulo', { description: error.message })
      // Refetch to restore state since optimistic update may now be stale.
      fetchAll()
      return
    }

    toast.success('Módulo eliminado', {
      description: `${moduleName} fue eliminado y el acceso quitado a todos los usuarios.`,
    })

    // Await the audit log so it completes before the component potentially unmounts
    await logAudit(supabase, {
      action_type: 'DELETE_MODULE',
      target_type: 'module',
      target_id: moduleId,
      target_label: moduleName,
      description: `Eliminó el módulo "${moduleName}" y quitó el acceso a todos los usuarios.`,
      metadata: {
        previous_state: {
          module: moduleSnapshotRes.data ?? null,
          access: accessSnapshotRes.data ?? [],
        },
        timestamp: new Date().toISOString(),
      },
    })
  }

  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return users.filter((u) => {
      if (filter === 'blocked'   && u.is_active)                    return false
      if (filter === 'admins'    && u.role !== 'admin')              return false
      if (filter === 'clients'   && u.role !== 'user')               return false
      if (filter === 'principal' && u.parent_user_id !== null)       return false
      if (filter === 'sub'       && u.parent_user_id === null)       return false
      if (!q) return true
      const name = (u.full_name ?? '').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [users, debouncedSearch, filter])

  const usersById = useMemo(() => {
    const map = new Map<string, UserRow>()
    users.forEach((user) => map.set(user.id, user))
    return map
  }, [users])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)

  const syncScrollLeft = useCallback((source: 'header' | 'body', scrollLeft: number) => {
    const target = source === 'header' ? bodyScrollRef.current : headerScrollRef.current
    if (target && Math.abs(target.scrollLeft - scrollLeft) > 0.5) {
      target.scrollLeft = scrollLeft
    }
  }, [])

  const tableColGroup = useMemo(
    () => (
      <colgroup>
        <col style={{ width: 340 }} />
        <col style={{ width: 140 }} />
        {modules.map((module) => (
          <col key={module.id} style={{ width: 120 }} />
        ))}
      </colgroup>
    ),
    [modules],
  )

  const tableMinWidth = 340 + 140 + modules.length * 120

  const handleExportExcel = async () => {
    const headers = [
      'Nombre',
      'Email',
      'Rol',
      'Estado',
      'Ultima Actividad',
      'Creado',
      ...modules.map((m) => m.name),
    ]
    const excelRows = filteredUsers.map((u) => {
      const cols: (string | number)[] = [
        u.full_name ?? '',
        u.email ?? '',
        u.role,
        u.is_active ? 'Activo' : 'Bloqueado',
        formatDateTime(u.last_activity_at),
        formatDateTime(u.created_at),
      ]
      modules.forEach((m) => {
        cols.push(access[accessKey(u.id, m.id)] ? 'Sí' : 'No')
      })
      return cols
    })

    const activos = filteredUsers.filter((u) => u.is_active).length

    await exportStyledReportExcel({
      sheetName: 'Usuarios',
      title: 'USUARIOS Y PERMISOS',
      moduleLabel: 'Administración — Usuarios',
      filename: `usuarios-upcrop-${new Date().toISOString().slice(0, 10)}.xlsx`,
      headers,
      rows: excelRows,
      instructions: [
        '1. Cada columna de módulo indica si el usuario tiene acceso (Sí/No).',
        '2. Use Estado para identificar cuentas bloqueadas o inactivas.',
        '3. El export refleja los filtros de búsqueda activos en pantalla.',
      ],
      summary: `Resumen: ${filteredUsers.length} usuario${filteredUsers.length !== 1 ? 's' : ''} · ${activos} activo${activos !== 1 ? 's' : ''} · ${modules.length} módulo${modules.length !== 1 ? 's' : ''}`,
      columnWidths: [
        20, 28, 14, 12, 18, 18,
        ...modules.map(() => 12),
      ],
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
            <SelectTrigger className="w-full sm:w-[200px] bg-secondary border-border">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="clients">Solo Clientes</SelectItem>
              <SelectItem value="admins">Solo Administradores</SelectItem>
              <SelectItem value="principal">Solo Clientes</SelectItem>
              <SelectItem value="sub">Solo Subusuarios</SelectItem>
              <SelectItem value="blocked">Solo Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setModuleDialogOpen(true)}
            className="bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Módulo
          </Button>
          <Button
            onClick={() => void handleExportExcel()}
            variant="outline"
            className="border-border hover:bg-primary hover:text-primary-foreground hover:border-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl">
        {/* Desktop: sticky block — header fijo arriba, filas con scroll interno */}
        <div className="hidden lg:flex lg:flex-col sticky top-16 z-40 max-h-[calc(100dvh-4rem)] bg-card shadow-[0_4px_16px_-6px_rgba(0,0,0,0.35)]">
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/50">
              <div className="flex items-center gap-2">
                <Radio
                  className={`w-4 h-4 ${isConnected ? 'text-primary' : 'text-muted-foreground'}`}
                />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Conectado en tiempo real' : 'Conectando...'}
                </span>
                {isConnected && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredUsers.length} de {users.length}{' '}
                {users.length === 1 ? 'usuario' : 'usuarios'}
              </span>
            </div>

            <div
              ref={headerScrollRef}
              className="overflow-x-auto overflow-y-hidden bg-secondary/95 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              onScroll={(e) => syncScrollLeft('header', e.currentTarget.scrollLeft)}
            >
              <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
                {tableColGroup}
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-semibold text-foreground w-[340px] min-w-[340px]">
                      Usuario
                    </th>
                    <th className="text-center p-4 font-semibold text-foreground text-xs whitespace-nowrap w-[140px] min-w-[140px]">
                      Última Actividad
                    </th>
                    {modules.map((module) => {
                      const Icon = getModuleIcon(module.icon)
                      const shapeCfg = getIconShape(module.icon_shape)
                      const iconContainer = resolveIconContainerStyle(module.color, shapeCfg.className)
                      const iconStyle = resolveIconStyle(module.color)
                      const textStyle = resolveTextStyle(module.text_color ?? null, module.color)
                      return (
                        <th
                          key={module.id}
                          className="text-center p-4 font-semibold text-foreground w-[120px] min-w-[120px]"
                        >
                          <div className="flex flex-col items-center gap-1.5">
                            <div
                              className={cn('w-8 h-8 flex items-center justify-center', iconContainer.className)}
                              style={iconContainer.style}
                            >
                              <Icon className={cn('w-4 h-4', iconStyle.className)} style={iconStyle.style} />
                            </div>
                            <span className={cn('text-xs font-semibold', textStyle.className)} style={textStyle.style}>{module.name}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditModuleTarget(module)}
                                aria-label={`Editar modulo ${module.name}`}
                                title={`Editar modulo ${module.name}`}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteModuleTarget(module)}
                                aria-label={`Eliminar modulo ${module.name}`}
                                title={`Eliminar modulo ${module.name}`}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
              </table>
            </div>
          </div>

          <div
            ref={bodyScrollRef}
            className="flex-1 min-h-0 overflow-auto overscroll-contain"
            onScroll={(e) => syncScrollLeft('body', e.currentTarget.scrollLeft)}
          >
            <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
              {tableColGroup}
              <tbody>
              {pageUsers.map((user, index) => {
                const isBlocking = blockingStates[user.id]
                const parentLabel = user.parent_user_id
                  ? usersById.get(user.parent_user_id)?.full_name ||
                    usersById.get(user.parent_user_id)?.email ||
                    'Cuenta principal'
                  : null
                const isPrimaryClient = user.role === 'user' && !user.parent_user_id
                const online = isUserOnline(user.last_activity_at)

                return (
                  <tr
                    key={user.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                      index === pageUsers.length - 1 ? 'border-b-0' : ''
                    } ${!user.is_active ? 'opacity-60' : ''}`}
                  >
                    {/* ── Sticky user cell ── */}
                    <td className="p-3 sticky left-0 bg-card z-20 w-[340px] min-w-[340px] border-r border-border/50 shadow-[1px_0_0_0_hsl(var(--border))]">
                      <div className="flex items-start gap-3">
                        {/* Avatar with status ring */}
                        <div className="relative shrink-0 mt-0.5">
                          <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center overflow-hidden ${
                            online
                              ? 'border-emerald-500/40'
                              : 'border-primary/20'
                          }`}>
                            {user.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.avatar_url} alt={user.full_name ?? ''} className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center ${online ? 'bg-emerald-500/15' : 'bg-primary/10'}`}>
                                <span className={`text-xs font-bold ${online ? 'text-emerald-600' : 'text-primary'}`}>
                                  {(user.full_name ?? user.email ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Online pulse */}
                          {online && user.is_active ? (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card bg-emerald-500">
                              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                            </span>
                          ) : (
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                                user.is_active ? 'bg-slate-400 dark:bg-slate-500' : 'bg-destructive'
                              }`}
                            />
                          )}
                        </div>

                        {/* Info block */}
                        <div className="flex-1 min-w-0">
                          {/* Row 1: name + role badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm text-foreground truncate leading-tight">
                              {user.full_name || 'Sin nombre'}
                            </p>
                            {user.role === 'admin' && (
                              <Badge className="h-4 px-1.5 text-[10px] inline-flex items-center gap-1 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20">
                                <Shield className="w-3 h-3 shrink-0" />
                                Admin
                              </Badge>
                            )}
                            {isPrimaryClient && (
                              <Badge className="h-4 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                                Cliente
                              </Badge>
                            )}
                            {user.role === 'user' && user.parent_user_id && (
                              <Badge className="h-4 px-1.5 text-[10px] bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                                Subusuario
                              </Badge>
                            )}
                            {!user.is_active && (
                              <Badge className="h-4 px-1.5 text-[10px] bg-destructive/15 text-destructive border border-destructive/30">
                                Bloqueado
                              </Badge>
                            )}
                          </div>

                          {/* Row 2: email */}
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {user.email}
                          </p>

                          {/* Row 3: parent label */}
                          {parentLabel && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Sub de {parentLabel}
                            </p>
                          )}

                          {/* Row 4: action buttons */}
                          <div className="flex items-center gap-0.5 mt-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditUserTarget(user)}
                              title="Editar nombre/correo"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDataAccessTarget(user)}
                              title="Acceso a tablas y gráficos"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            >
                              <Database className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setOrderTarget(user)}
                              title="Orden de módulos"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            >
                              <ListOrdered className="w-3.5 h-3.5" />
                            </Button>
                            {isPrimaryClient && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSubuserTarget(user)}
                                title="Crear subusuario"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {user.role === 'user' && user.is_active && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={impersonatingId === user.id}
                                onClick={() => handleViewAsClient(user)}
                                title="Ver como cliente (modo soporte)"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10"
                              >
                                {impersonatingId === user.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                            {/* Separator */}
                            <span className="w-px h-4 bg-border/60 mx-1" />
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isBlocking}
                              onClick={() => handleBlockClick(user)}
                              title={user.is_active ? 'Bloquear cuenta' : 'Desbloquear cuenta'}
                              className={`h-7 w-7 p-0 ${
                                user.is_active
                                  ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                  : 'text-primary hover:text-primary hover:bg-primary/10'
                              }`}
                            >
                              {isBlocking ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : user.is_active ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Última Actividad */}
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {online && user.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                            En línea
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-foreground tabular-nums whitespace-nowrap">
                            {formatTimeAgo(user.last_activity_at) ?? '—'}
                          </span>
                        )}
                        {user.last_activity_at && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDateTime(user.last_activity_at)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Module toggles */}
                    {modules.map((module) => {
                      const key = accessKey(user.id, module.id)
                      const isChecked = !!access[key]
                      const loading = loadingStates[key]
                      return (
                        <td key={module.id} className="p-4 text-center">
                           <div className="flex justify-center">
                             {loading ? (
                               <Loader2 className="w-5 h-5 animate-spin text-primary" />
                             ) : module.is_core ? (
                               <span
                                 className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200"
                                 title="Módulo obligatorio - siempre activo para todos los clientes"
                               >
                                 Obligatorio
                               </span>
                             ) : (
                               <Switch
                                 checked={isChecked}
                                 disabled={!user.is_active}
                                 onCheckedChange={(checked) =>
                                   handleAccessChange(user.id, module.id, checked)
                                 }
                                 className="data-[state=checked]:bg-primary"
                               />
                             )}
                           </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>

          {!isLoading && filteredUsers.length > 0 && (
            <UserTablePagination
              safePage={safePage}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              totalItems={filteredUsers.length}
              onPageChange={setPage}
            />
          )}
        </div>

        {/* Mobile status bar */}
        <div className="flex lg:hidden items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/50">
          <div className="flex items-center gap-2">
            <Radio
              className={`w-4 h-4 ${isConnected ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Conectado en tiempo real' : 'Conectando...'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredUsers.length} de {users.length}{' '}
            {users.length === 1 ? 'usuario' : 'usuarios'}
          </span>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-border">
          <div className="sticky top-16 z-30 bg-card/95 backdrop-blur-sm border-b border-border p-4 space-y-3 shadow-sm">
            {modules.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {modules.map((module) => {
                  const Icon = getModuleIcon(module.icon)
                  return (
                    <div
                      key={module.id}
                      className="flex items-center gap-1.5 bg-secondary/60 border border-border rounded-full pl-3 pr-1.5 py-1"
                    >
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-foreground">{module.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditModuleTarget(module)}
                        aria-label={`Editar módulo ${module.name}`}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteModuleTarget(module)}
                        aria-label={`Eliminar módulo ${module.name}`}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {pageUsers.map((user) => {
            const isBlocking = blockingStates[user.id]
            const parentLabel = user.parent_user_id
              ? usersById.get(user.parent_user_id)?.full_name ||
                usersById.get(user.parent_user_id)?.email ||
                'Cuenta principal'
              : null
            const isPrimaryClient = user.role === 'user' && !user.parent_user_id
            return (
              <div
                key={user.id}
                className={`p-4 space-y-4 ${!user.is_active ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {user.full_name || 'Sin nombre'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Última actividad: {formatDateTime(user.last_activity_at)}
                    </p>
                    {parentLabel && (
                      <p className="text-xs text-muted-foreground truncate">
                        Subusuario de {parentLabel}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {user.role === 'admin' && (
                      <Badge className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        Admin
                      </Badge>
                    )}
                    {isPrimaryClient && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                        Cliente
                      </Badge>
                    )}
                    {user.role === 'user' && user.parent_user_id && (
                      <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                        Subusuario
                      </Badge>
                    )}
                    {user.is_active ? (
                      <Badge className="bg-primary/15 text-primary border border-primary/30">
                        Activo
                      </Badge>
                    ) : (
                      <Badge className="bg-destructive/15 text-destructive border border-destructive/30">
                        Bloqueado
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={user.is_active ? 'outline' : 'default'}
                  disabled={isBlocking}
                  onClick={() => handleBlockClick(user)}
                  className={`w-full ${
                    user.is_active
                      ? 'border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                >
                  {isBlocking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : user.is_active ? (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Bloquear cuenta
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      Desbloquear cuenta
                    </>
                  )}
                </Button>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditUserTarget(user)}
                    className="flex-1"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDataAccessTarget(user)}
                    className="flex-1"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Datos
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOrderTarget(user)}
                  className="w-full"
                >
                  <ListOrdered className="w-4 h-4 mr-2" />
                  Orden de módulos
                </Button>
                {user.role === 'user' && user.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={impersonatingId === user.id}
                    onClick={() => handleViewAsClient(user)}
                    className="w-full border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                  >
                    {impersonatingId === user.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Ver como cliente
                  </Button>
                )}
                {isPrimaryClient && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSubuserTarget(user)}
                    className="w-full"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Crear subusuario
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {modules.map((module) => {
                    const Icon = getModuleIcon(module.icon)
                    const key = accessKey(user.id, module.id)
                    const isChecked = !!access[key]
                    const loading = loadingStates[key]
                    return (
                      <div
                        key={module.id}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate">
                            {module.name}
                          </span>
                        </div>
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <Switch
                            checked={isChecked}
                            disabled={!user.is_active}
                            onCheckedChange={(checked) =>
                              handleAccessChange(user.id, module.id, checked)
                            }
                            className="data-[state=checked]:bg-primary scale-90"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {isLoading && (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando usuarios...</p>
          </div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {users.length === 0
                ? 'No hay usuarios registrados'
                : 'No se encontraron usuarios con los filtros aplicados'}
            </p>
          </div>
        )}

        {/* Pagination (mobile + respaldo al final de la tarjeta) */}
        {!isLoading && filteredUsers.length > 0 && (
          <div className="lg:hidden">
            <UserTablePagination
              safePage={safePage}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              totalItems={filteredUsers.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Block confirmation modal */}
      <AlertDialog
        open={!!blockTarget}
        onOpenChange={(open) => !open && setBlockTarget(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-destructive/15 border border-destructive/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-foreground">
                ¿Bloquear esta cuenta?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-muted-foreground">
              Vas a bloquear el acceso de{' '}
              <span className="text-foreground font-medium">
                {blockTarget?.full_name || blockTarget?.email}
              </span>
              . El usuario no podrá usar los módulos hasta que sea desbloqueado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockTarget && toggleBlock(blockTarget)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Lock className="w-4 h-4 mr-2" />
              Bloquear cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateModuleDialog
        open={moduleDialogOpen}
        onOpenChange={setModuleDialogOpen}
      />

      <EditModuleDialog
        open={!!editModuleTarget}
        onOpenChange={(open) => !open && setEditModuleTarget(null)}
        module={editModuleTarget}
      />

      {/* Delete module confirmation */}
      <AlertDialog
        open={!!deleteModuleTarget}
        onOpenChange={(open) => !open && !isDeletingModule && setDeleteModuleTarget(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-destructive/15 border border-destructive/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-foreground">
                Eliminar módulo
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro de eliminar el módulo{' '}
              <span className="text-foreground font-semibold">
                {deleteModuleTarget?.name}
              </span>
              ? Esta acción es irreversible y quitará el acceso a todos los usuarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingModule} className="border-border">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingModule}
              onClick={(e) => {
                e.preventDefault()
                handleDeleteModule()
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeletingModule ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar módulo
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit user dialog */}
      <EditUserDialog
        open={!!editUserTarget}
        onOpenChange={(open) => !open && setEditUserTarget(null)}
        user={editUserTarget}
      />

      {/* Data access dialog */}
      <UserDataAccessDialog
        open={!!dataAccessTarget}
        onOpenChange={(open) => !open && setDataAccessTarget(null)}
        user={dataAccessTarget}
      />

      <CreateSubuserDialog
        open={!!subuserTarget}
        onOpenChange={(open) => !open && setSubuserTarget(null)}
        parentUser={subuserTarget}
      />

      <ModuleOrderDialog
        open={!!orderTarget}
        onOpenChange={(open) => !open && setOrderTarget(null)}
        user={orderTarget}
        modules={modules}
        accessRows={Object.entries(access).map(([key, enabled]) => {
          const [user_id, module_id] = key.split(':')
          return {
            user_id,
            module_id,
            enabled,
            display_order: accessOrder[key] ?? 0,
          }
        })}
        onOrderSaved={fetchAll}
      />
    </div>
  )
}
