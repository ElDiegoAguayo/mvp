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
  ChevronDown,
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
  Layers,
  Crown,
  HardHat,
} from 'lucide-react'
import { getModuleIcon, getIconShape, resolveIconContainerStyle, resolveIconStyle, resolveTextStyle } from '@/lib/module-icons'
import { cn } from '@/lib/utils'
import {
  canEnableSubuserModule,
  isSubuserModuleSwitchDisabled,
  subuserModuleSwitchTitle,
} from '@/lib/admin/subuser-module-access'
import {
  inspectorModuleCellState,
  inspectorModuleSwitchTitle,
} from '@/lib/admin/inspector-module-access'
import { exportStyledReportExcel } from '@/lib/excel/upcrop-excel-theme'
import { CreateModuleDialog } from './create-module-dialog'
import { EditModuleDialog } from './edit-module-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { UserDataAccessDialog } from './user-data-access-dialog'
import { CreateSubuserDialog } from './create-subuser-dialog'
import { InspectorClientsDialog } from './inspector-clients-dialog'
import { ModuleOrderDialog } from './module-order-dialog'
import { ManageModuleAreasDialog } from './manage-module-areas-dialog'
import { AssignServicePlanDialog } from './assign-service-plan-dialog'
import { SendUserInviteButton } from './send-user-invite-button'
import {
  getServicePlanBadgeClass,
  getServicePlanLabel,
} from '@/lib/service-plan-admin'
import { isPrincipalClientProfile } from '@/lib/profiles/principal-clients'
import { isServicePlanId, type ServicePlanId } from '@/lib/subscription-plans'
import { logAudit } from '@/lib/audit-log'
import { compareModulesByAreaThenName, groupModulesByArea, buildModuleAreaCellMeta, moduleAreaCellClassName, type ModuleArea } from '@/lib/modules/areas'
import { fetchActiveModules } from '@/lib/modules/fetch-active-modules'
import { startImpersonationAction } from '@/app/admin/impersonation-actions'

interface ModuleRow {
  id: string
  slug: string
  name: string
  icon: string
  color?: string | null
  text_color?: string | null
  icon_shape?: string | null
  icon_size?: string | null
  icon_style?: string | null
  menu_badge?: string | null
  description: string | null
  is_active: boolean
  is_core?: boolean
  embed_url?: string | null
  area_id?: string | null
  area?: ModuleArea | null
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
  service_plan_id?: ServicePlanId | null
  is_tech_inspector?: boolean
}
const PAGE_SIZE = 10
const AREA_HEADER_ROW_HEIGHT = 52
const MODULE_HEADER_ROW_HEIGHT = 112

const STICKY_USER_HEAD =
  'sticky left-0 z-[50] w-[340px] min-w-[340px] max-w-[340px] bg-card border-r border-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.18)]'
const STICKY_ACTIVITY_HEAD =
  'sticky left-[340px] z-[50] w-[140px] min-w-[140px] max-w-[140px] bg-card border-r border-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.18)]'
const STICKY_USER_BODY =
  'sticky left-0 z-[40] w-[340px] min-w-[340px] max-w-[340px] bg-card border-r border-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.18)]'
const STICKY_ACTIVITY_BODY =
  'sticky left-[340px] z-[40] w-[140px] min-w-[140px] max-w-[140px] bg-card border-r border-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.18)]'

type FilterValue = 'all' | 'blocked' | 'admins' | 'clients' | 'principal' | 'sub' | 'inspector'

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
  const [areasDialogOpen, setAreasDialogOpen] = useState(false)
  const [editModuleTarget, setEditModuleTarget] = useState<ModuleRow | null>(null)
  const [deleteModuleTarget, setDeleteModuleTarget] = useState<ModuleRow | null>(null)
  const [isDeletingModule, setIsDeletingModule] = useState(false)
  const [editUserTarget, setEditUserTarget] = useState<UserRow | null>(null)
  const [dataAccessTarget, setDataAccessTarget] = useState<UserRow | null>(null)
  const [inspectorClientsTarget, setInspectorClientsTarget] = useState<UserRow | null>(null)
  const [subuserTarget, setSubuserTarget] = useState<UserRow | null>(null)
  const [orderTarget, setOrderTarget] = useState<UserRow | null>(null)
  const [assignPlanTarget, setAssignPlanTarget] = useState<UserRow | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)
  const [expandedMobileUserId, setExpandedMobileUserId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  // Ticker to force re-render every 30s so relative times stay fresh
  const [, setTick] = useState(0)

  const accessKey = (userId: string, moduleId: string) => `${userId}:${moduleId}`

  const refreshModules = useCallback(async () => {
    try {
      const loaded = (await fetchActiveModules(supabase)) as ModuleRow[]
      setModules(loaded)
    } catch (err) {
      console.error('[v0] modules refresh error:', err)
    }
  }, [supabase])

  const fetchAll = useCallback(async () => {
    const accessPromise = supabase
      .from('user_module_access')
      .select('user_id, module_id, enabled, display_order')

    let usersRes = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, role, created_at, is_active, last_activity_at, parent_user_id, avatar_url, service_plan_id, is_tech_inspector',
      )
      .order('created_at', { ascending: false })

    if (usersRes.error?.message?.includes('service_plan_id') || usersRes.error?.message?.includes('is_tech_inspector')) {
      usersRes = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, role, created_at, is_active, last_activity_at, parent_user_id, avatar_url',
        )
        .order('created_at', { ascending: false })
    }

    const accessRes = await accessPromise

    // Resilient modules fetch (supports missing is_core column during migration)
    let loadedModules: ModuleRow[] = []
    try {
      loadedModules = (await fetchActiveModules(supabase)) as ModuleRow[]
    } catch {
      loadedModules = []
    }

    if (usersRes.error) console.error('[v0] users error:', usersRes.error)
    if (accessRes.error) console.error('[v0] access error:', accessRes.error)

    const normalizedUsers = ((usersRes.data ?? []) as UserRow[]).map(user => ({
      ...user,
      service_plan_id: isServicePlanId(user.service_plan_id as string | null)
        ? user.service_plan_id
        : null,
    }))

    setUsers(normalizedUsers)
    setModules(loadedModules)


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
          const service_plan_id = isServicePlanId(newUser.service_plan_id as string | null)
            ? newUser.service_plan_id
            : null
          setUsers((prev) =>
            prev.some((u) => u.id === newUser.id)
              ? prev
              : [{ ...newUser, service_plan_id }, ...prev],
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as UserRow
          const service_plan_id = isServicePlanId(updated.service_plan_id as string | null)
            ? updated.service_plan_id
            : null
          setUsers((prev) =>
            prev.map((u) =>
              u.id === updated.id ? { ...u, ...updated, service_plan_id } : u,
            ),
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
        () => { void refreshModules() },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'module_areas' },
        () => { void refreshModules() },
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
  }, [supabase, fetchAll, refreshModules])

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
      if (!res.ok) {
        toast.error('No se pudo iniciar modo soporte', { description: res.message })
        setImpersonatingId(null)
        return
      }
      window.location.assign(res.redirectTo)
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

    const user = users.find((u) => u.id === userId)
    if (!user) return

    if (user.is_tech_inspector) {
      toast.error('Los inspectores solo pueden tener Asistencia técnica y Estimación de cosecha (conteo)')
      return
    }

    if (user.parent_user_id && checked && !canEnableSubuserModule(access, user.parent_user_id, moduleId)) {
      toast.error('No se puede activar el módulo', {
        description: 'El cliente principal no tiene este módulo activo.',
      })
      return
    }

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

    if (!user.parent_user_id && !checked) {
      const subs = users.filter((u) => u.parent_user_id === userId)
      const subUpdates = subs
        .filter((sub) => access[accessKey(sub.id, moduleId)])
        .map((sub) => ({
          user_id: sub.id,
          module_id: moduleId,
          enabled: false,
          updated_at: new Date().toISOString(),
        }))

      if (subUpdates.length > 0) {
        const { error: cascadeError } = await supabase
          .from('user_module_access')
          .upsert(subUpdates, { onConflict: 'user_id,module_id' })

        if (cascadeError) {
          toast.error('Módulo desactivado para el cliente, pero falló en subusuarios', {
            description: cascadeError.message,
          })
        } else {
          setAccess((prev) => {
            const next = { ...prev, [key]: checked }
            for (const sub of subs) {
              next[accessKey(sub.id, moduleId)] = false
            }
            return next
          })
        }
      }
    }

    const moduleObj = modules.find((m) => m.id === moduleId)
    const userLabel = user.full_name || user.email || 'usuario'
    const moduleLabel = moduleObj?.name ?? 'módulo'
    logAudit(supabase, {
      action_type: 'UPDATE_PERMISSION',
      target_type: 'user_module_access',
      target_id: userId,
      target_label: `${userLabel} / ${moduleLabel}`,
      description: `${checked ? 'Activó' : 'Desactivó'} el módulo "${moduleLabel}" para ${userLabel} (${user.email ?? ''}).`,
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
      if (filter === 'principal' && (u.parent_user_id !== null || u.is_tech_inspector)) return false
      if (filter === 'sub'       && u.parent_user_id === null && !u.is_tech_inspector) return false
      if (filter === 'inspector' && !u.is_tech_inspector)                              return false
      if (!q) return true
      const name = (u.full_name ?? '').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [users, debouncedSearch, filter])

  const primaryClientOptions = useMemo(
    () =>
      users
        .filter(isPrincipalClientProfile)
        .map(u => ({ id: u.id, label: u.full_name?.trim() || u.email || u.id })),
    [users],
  )

  const usersById = useMemo(() => {
    const map = new Map<string, UserRow>()
    users.forEach((user) => map.set(user.id, user))
    return map
  }, [users])

  const sortedModules = useMemo(
    () => [...modules].sort((a, b) => compareModulesByAreaThenName(a, b)),
    [modules],
  )

  const moduleGroups = useMemo(
    () => groupModulesByArea(sortedModules),
    [sortedModules],
  )

  const moduleAreaMeta = useMemo(
    () => buildModuleAreaCellMeta(moduleGroups),
    [moduleGroups],
  )

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setExpandedMobileUserId(null)
  }, [safePage])

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
        {sortedModules.map((module) => (
          <col key={module.id} style={{ width: 120 }} />
        ))}
      </colgroup>
    ),
    [sortedModules],
  )

  const tableMinWidth = 340 + 140 + sortedModules.length * 120

  const handleExportExcel = async () => {
    const headers = [
      'Nombre',
      'Email',
      'Rol',
      'Estado',
      'Ultima Actividad',
      'Creado',
      ...sortedModules.map((m) => m.name),
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
        ...sortedModules.map(() => 12),
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
              <SelectItem value="inspector">Solo Inspectores</SelectItem>
              <SelectItem value="blocked">Solo Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-2">
          <Button
            onClick={() => setAreasDialogOpen(true)}
            variant="outline"
            className="w-full border-border hover:bg-primary hover:text-primary-foreground hover:border-primary lg:w-auto"
          >
            <Layers className="w-4 h-4 mr-2" />
            Áreas
          </Button>
          <Button
            onClick={() => setModuleDialogOpen(true)}
            className="w-full bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/30 lg:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Módulo
          </Button>
          <Button
            onClick={() => void handleExportExcel()}
            variant="outline"
            className="w-full border-border hover:bg-primary hover:text-primary-foreground hover:border-primary lg:w-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl">
        {/* Desktop: sticky block — header fijo arriba, filas con scroll interno */}
        <div className="hidden lg:flex lg:flex-col sticky top-16 z-40 max-h-[calc(100dvh-4rem)] bg-card shadow-[0_4px_16px_-6px_rgba(0,0,0,0.35)]">
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/50">
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

          {/* Cabecera fija: áreas + módulos (no hace scroll vertical) */}
          <div
            ref={headerScrollRef}
            className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-border bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => syncScrollLeft('header', e.currentTarget.scrollLeft)}
          >
            <table
              className="table-fixed border-separate border-spacing-0"
              style={{ width: tableMinWidth, minWidth: tableMinWidth }}
            >
              {tableColGroup}
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className={cn(
                      STICKY_USER_HEAD,
                      'text-left p-4 font-semibold text-foreground align-middle',
                    )}
                    style={{ height: AREA_HEADER_ROW_HEIGHT + MODULE_HEADER_ROW_HEIGHT }}
                  >
                    Usuario
                  </th>
                  <th
                    rowSpan={2}
                    className={cn(
                      STICKY_ACTIVITY_HEAD,
                      'text-center p-4 font-semibold text-foreground text-xs whitespace-nowrap align-middle',
                    )}
                    style={{ height: AREA_HEADER_ROW_HEIGHT + MODULE_HEADER_ROW_HEIGHT }}
                  >
                    Última Actividad
                  </th>
                  {moduleGroups.map((group) => (
                    <th
                      key={group.area.id}
                      colSpan={group.modules.length}
                      className={cn(
                        'p-0 align-middle border-l-[3px] border-l-border',
                        moduleAreaMeta.areaHeaderTintClass.get(group.area.id),
                      )}
                      style={{ height: AREA_HEADER_ROW_HEIGHT }}
                    >
                      <div className="h-full px-2 flex flex-col items-center justify-center gap-0.5 border-b border-border">
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground leading-tight text-center px-1 line-clamp-2">
                          {group.area.name}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/60">
                          {group.modules.length} módulo{group.modules.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  {sortedModules.map((module) => {
                    const Icon = getModuleIcon(module.icon)
                    const shapeCfg = getIconShape(module.icon_shape)
                    const iconContainer = resolveIconContainerStyle(module.color, shapeCfg.className, module.icon_style)
                    const iconStyle = resolveIconStyle(module.color, module.icon_style)
                    const textStyle = resolveTextStyle(module.text_color ?? null, module.color)
                    return (
                      <th
                        key={module.id}
                        className={cn(
                          'text-center p-3 font-semibold text-foreground w-[120px] min-w-[120px] bg-card align-middle',
                          moduleAreaCellClassName(module.id, moduleAreaMeta),
                        )}
                        style={{ height: MODULE_HEADER_ROW_HEIGHT }}
                      >
                        <div className="flex flex-col items-center justify-center gap-1 h-full">
                          <div
                            className={cn('w-8 h-8 flex items-center justify-center shrink-0', iconContainer.className)}
                            style={iconContainer.style}
                          >
                            <Icon className={cn('w-4 h-4', iconStyle.className)} style={iconStyle.style} />
                          </div>
                          <span
                            className={cn('text-xs font-semibold leading-tight line-clamp-2 px-0.5', textStyle.className)}
                            style={textStyle.style}
                          >
                            {module.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
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

          {/* Filas de usuarios: scroll vertical + horizontal sincronizado con cabecera */}
          <div
            ref={bodyScrollRef}
            className="flex-1 min-h-0 overflow-auto overscroll-contain isolate bg-card"
            onScroll={(e) => syncScrollLeft('body', e.currentTarget.scrollLeft)}
          >
            <table
              className="table-fixed border-separate border-spacing-0"
              style={{ width: tableMinWidth, minWidth: tableMinWidth }}
            >
              {tableColGroup}
              <tbody>
              {pageUsers.map((user, index) => {
                const isBlocking = blockingStates[user.id]
                const parentLabel = user.parent_user_id
                  ? usersById.get(user.parent_user_id)?.full_name ||
                    usersById.get(user.parent_user_id)?.email ||
                    'Cuenta principal'
                  : null
                const isPrimaryClient = isPrincipalClientProfile(user)
                const online = isUserOnline(user.last_activity_at)

                return (
                  <tr
                    key={user.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                      index === pageUsers.length - 1 ? 'border-b-0' : ''
                    } ${!user.is_active ? 'opacity-60' : ''}`}
                  >
                    {/* ── Sticky user cell ── */}
                    <td className={cn('p-3', STICKY_USER_BODY)}>
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
                            {user.is_tech_inspector && (
                              <Badge className="h-4 px-1.5 text-[10px] bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                                Inspector
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

                          {isPrimaryClient && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {user.service_plan_id ? (
                                <Badge
                                  variant="outline"
                                  className={cn('h-5 px-1.5 text-[10px]', getServicePlanBadgeClass(user.service_plan_id))}
                                >
                                  {getServicePlanLabel(user.service_plan_id)}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                                  Sin plan
                                </Badge>
                              )}
                            </div>
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
                            <SendUserInviteButton
                              userId={user.id}
                              email={user.email}
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground hover:text-sky-600 hover:bg-sky-500/10"
                            />
                            {!user.is_tech_inspector && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDataAccessTarget(user)}
                                title="Acceso a tablas y gráficos"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              >
                                <Database className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {!user.is_tech_inspector && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setOrderTarget(user)}
                                title="Orden de módulos"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              >
                                <ListOrdered className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {isPrimaryClient && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setAssignPlanTarget(user)}
                                title="Asignar plan de servicio"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                              >
                                <Crown className="w-3.5 h-3.5" />
                              </Button>
                            )}
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
                            {user.is_tech_inspector && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setInspectorClientsTarget(user)}
                                title="Asignar clientes al inspector"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-sky-600 hover:bg-sky-500/10"
                              >
                                <HardHat className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {user.role === 'user' && user.is_active && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={impersonatingId === user.id}
                                onClick={() => handleViewAsClient(user)}
                                title={
                                  user.is_tech_inspector
                                    ? 'Ver como inspector (modo soporte)'
                                    : 'Ver como cliente (modo soporte)'
                                }
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
                    <td className={cn('p-4 text-center', STICKY_ACTIVITY_BODY)}>
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
                    {sortedModules.map((module) => {
                      const key = accessKey(user.id, module.id)
                      const isChecked = !!access[key]
                      const loading = loadingStates[key]
                      const inspectorCell = inspectorModuleCellState(user, module)
                      const switchDisabled =
                        inspectorCell !== null ||
                        isSubuserModuleSwitchDisabled(access, user, module.id, isChecked)
                      const switchTitle =
                        inspectorModuleSwitchTitle(user, module) ??
                        subuserModuleSwitchTitle(access, user, module.id, isChecked)
                      return (
                        <td
                          key={module.id}
                          className={cn(
                            'p-4 text-center bg-card',
                            moduleAreaCellClassName(module.id, moduleAreaMeta),
                          )}
                        >
                           <div className="flex justify-center">
                             {loading ? (
                               <Loader2 className="w-5 h-5 animate-spin text-primary" />
                             ) : inspectorCell === 'locked-on' ? (
                               <span
                                 className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-400 border border-sky-500/30"
                                 title={switchTitle}
                               >
                                 Inspector
                               </span>
                             ) : inspectorCell === 'locked-off' ? (
                               <span className="text-xs text-muted-foreground" title={switchTitle}>
                                 —
                               </span>
                             ) : module.is_core ? (
                               <span
                                 className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200"
                                 title="Módulo obligatorio - siempre activo para todos los clientes"
                               >
                                 Obligatorio
                               </span>
                             ) : (
                               <span title={switchTitle}>
                                 <Switch
                                   checked={isChecked}
                                   disabled={switchDisabled}
                                   onCheckedChange={(checked) =>
                                     handleAccessChange(user.id, module.id, checked)
                                   }
                                   className="data-[state=checked]:bg-primary"
                                 />
                               </span>
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

        {/* Mobile: catálogo de módulos colapsable (no bloquea la lista de usuarios) */}
        <div className="lg:hidden border-b border-border">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-secondary/50 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Módulos y áreas</p>
                <p className="text-xs text-muted-foreground">
                  {sortedModules.length} módulo{sortedModules.length !== 1 ? 's' : ''} · editar o eliminar
                </p>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            {sortedModules.length > 0 && (
              <div className="max-h-[min(55vh,28rem)] space-y-3 overflow-y-auto overscroll-contain p-4">
                {moduleGroups.map((group) => (
                  <div
                    key={group.area.id}
                    className={cn(
                      'overflow-hidden rounded-xl border-2 border-border',
                      moduleAreaMeta.areaHeaderTintClass.get(group.area.id),
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-foreground line-clamp-2">
                        {group.area.name}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {group.modules.length} mód.
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 bg-background/40 p-3">
                      {group.modules.map((module) => {
                        const Icon = getModuleIcon(module.icon)
                        return (
                          <div
                            key={module.id}
                            className="flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 text-sm text-foreground">{module.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditModuleTarget(module)}
                              aria-label={`Editar módulo ${module.name}`}
                              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteModuleTarget(module)}
                              aria-label={`Eliminar módulo ${module.name}`}
                              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </details>
        </div>

        {/* Mobile user cards */}
        <div className="lg:hidden">
          {pageUsers.map((user) => {
            const isBlocking = blockingStates[user.id]
            const parentLabel = user.parent_user_id
              ? usersById.get(user.parent_user_id)?.full_name ||
                usersById.get(user.parent_user_id)?.email ||
                'Cuenta principal'
              : null
            const isPrimaryClient = isPrincipalClientProfile(user)
            const isExpanded = expandedMobileUserId === user.id
            return (
              <div
                key={user.id}
                className={cn('border-b border-border', !user.is_active && 'opacity-70')}
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {user.full_name || 'Sin nombre'}
                    </p>
                    {!isExpanded && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {user.role === 'admin' && (
                          <Badge className="inline-flex items-center gap-1 border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400">
                            <Shield className="h-3 w-3 shrink-0" />
                            Admin
                          </Badge>
                        )}
                        {isPrimaryClient && (
                          <Badge className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-600">
                            Cliente
                          </Badge>
                        )}
                        {user.role === 'user' && user.parent_user_id && (
                          <Badge className="border border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400">
                            Sub usuario
                          </Badge>
                        )}
                        {user.is_tech_inspector && (
                          <Badge className="border border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-400">
                            Inspector
                          </Badge>
                        )}
                        {!user.is_active && (
                          <Badge className="border border-destructive/30 bg-destructive/15 text-destructive">
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                    )}
                    <p className={cn('truncate text-sm text-muted-foreground', !isExpanded ? 'mt-1' : 'mt-0.5')}>
                      {user.email}
                    </p>
                    {isExpanded && (
                      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        <p>Última actividad: {formatDateTime(user.last_activity_at)}</p>
                        {parentLabel && <p className="truncate">Sub usuario de {parentLabel}</p>}
                        {isPrimaryClient && (
                          <div className="pt-1">
                            {user.service_plan_id ? (
                              <Badge
                                variant="outline"
                                className={cn('text-[10px]', getServicePlanBadgeClass(user.service_plan_id))}
                              >
                                {getServicePlanLabel(user.service_plan_id)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Sin plan de servicio
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {user.role === 'admin' && (
                        <Badge className="inline-flex items-center gap-1 border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400">
                          <Shield className="h-3 w-3 shrink-0" />
                          Admin
                        </Badge>
                      )}
                      {isPrimaryClient && (
                        <Badge className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-600">
                          Cliente
                        </Badge>
                      )}
                      {user.role === 'user' && user.parent_user_id && (
                        <Badge className="border border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400">
                          Sub usuario
                        </Badge>
                      )}
                      {user.is_tech_inspector && (
                        <Badge className="border border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-400">
                          Inspector
                        </Badge>
                      )}
                      {user.is_active ? (
                        <Badge className="border border-primary/30 bg-primary/15 text-primary">
                          Activo
                        </Badge>
                      ) : (
                        <Badge className="border border-destructive/30 bg-destructive/15 text-destructive">
                          Bloqueado
                        </Badge>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Ocultar detalle del usuario' : 'Ver detalle del usuario'}
                    onClick={() => setExpandedMobileUserId(isExpanded ? null : user.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-lg border border-border bg-secondary/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn('h-5 w-5 transition-transform duration-200', isExpanded && 'rotate-180')}
                    />
                  </button>
                </div>

                {isExpanded && (
                <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-3">
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

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditUserTarget(user)}
                    className="min-w-[calc(50%-0.25rem)] flex-1"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <SendUserInviteButton
                    userId={user.id}
                    email={user.email}
                    fullName={user.full_name}
                    variant="outline"
                    size="sm"
                    className="min-w-[calc(50%-0.25rem)] flex-1 border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
                  />
                  {!user.is_tech_inspector && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDataAccessTarget(user)}
                      className="w-full sm:min-w-[calc(50%-0.25rem)] sm:flex-1"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      Datos
                    </Button>
                  )}
                </div>
                {!user.is_tech_inspector && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOrderTarget(user)}
                    className="w-full"
                  >
                    <ListOrdered className="w-4 h-4 mr-2" />
                    Orden de módulos
                  </Button>
                )}
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
                    {user.is_tech_inspector ? 'Ver como inspector' : 'Ver como cliente'}
                  </Button>
                )}
                {isPrimaryClient && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignPlanTarget(user)}
                    className="w-full border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Asignar plan de servicio
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

                <div className="space-y-3">
                  {moduleGroups.map((group) => (
                    <div
                      key={group.area.id}
                      className={cn(
                        'overflow-hidden rounded-xl border-2 border-border',
                        moduleAreaMeta.areaHeaderTintClass.get(group.area.id),
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-foreground line-clamp-2">
                          {group.area.name}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {group.modules.length} mód.
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 bg-background/30 p-3 sm:grid-cols-2">
                        {group.modules.map((module) => {
                          const Icon = getModuleIcon(module.icon)
                          const key = accessKey(user.id, module.id)
                          const isChecked = !!access[key]
                          const loading = loadingStates[key]
                          const inspectorCell = inspectorModuleCellState(user, module)
                          const switchDisabled =
                            inspectorCell !== null ||
                            isSubuserModuleSwitchDisabled(access, user, module.id, isChecked)
                          const switchTitle =
                            inspectorModuleSwitchTitle(user, module) ??
                            subuserModuleSwitchTitle(access, user, module.id, isChecked)
                          return (
                            <div
                              key={module.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 p-3"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm text-foreground break-words" title={switchTitle}>
                                  {module.name}
                                </span>
                              </div>
                              {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              ) : inspectorCell === 'locked-on' ? (
                                <span className="text-[10px] text-sky-600 dark:text-sky-400">Inspector</span>
                              ) : inspectorCell === 'locked-off' ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : module.is_core ? (
                                <span className="text-[10px] text-emerald-600">Obligatorio</span>
                              ) : (
                                <span title={switchTitle}>
                                  <Switch
                                    checked={isChecked}
                                    disabled={switchDisabled}
                                    onCheckedChange={(checked) =>
                                      handleAccessChange(user.id, module.id, checked)
                                    }
                                    className="data-[state=checked]:bg-primary scale-90"
                                  />
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                </div>
                )}
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
        onCreated={refreshModules}
      />

      <EditModuleDialog
        open={!!editModuleTarget}
        onOpenChange={(open) => !open && setEditModuleTarget(null)}
        module={editModuleTarget}
        onSaved={refreshModules}
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

      <InspectorClientsDialog
        open={!!inspectorClientsTarget}
        onOpenChange={open => !open && setInspectorClientsTarget(null)}
        inspector={inspectorClientsTarget}
        clients={primaryClientOptions}
      />

      <ModuleOrderDialog
        open={!!orderTarget}
        onOpenChange={(open) => !open && setOrderTarget(null)}
        user={orderTarget}
        modules={sortedModules}
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

      <ManageModuleAreasDialog
        open={areasDialogOpen}
        onOpenChange={setAreasDialogOpen}
        onAreasChanged={fetchAll}
      />

      <AssignServicePlanDialog
        open={!!assignPlanTarget}
        onOpenChange={open => !open && setAssignPlanTarget(null)}
        user={assignPlanTarget}
        onSaved={(userId, planId) => {
          setUsers(prev =>
            prev.map(u => (u.id === userId ? { ...u, service_plan_id: planId } : u)),
          )
        }}
      />
    </div>
  )
}
