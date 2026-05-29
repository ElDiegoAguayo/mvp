import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditActionType =
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'BLOCK_USER'
  | 'UNBLOCK_USER'
  | 'UPDATE_PERMISSION'
  | 'CREATE_MODULE'
  | 'UPDATE_MODULE'
  | 'DELETE_MODULE'
  | 'CREATE_DYNAMIC_TABLE'
  | 'UPDATE_DYNAMIC_TABLE'
  | 'DELETE_DYNAMIC_TABLE'
  | 'UPDATE_TABLE_COLUMNS'
  | 'CREATE_CHART'
  | 'UPDATE_CHART'
  | 'DELETE_CHART'
  | 'IMPORT_EXCEL'
  | 'UPDATE_PASSWORD'
  | 'UPDATE_DATA_ACCESS'
  | 'RESTORE'
  | 'SYSTEM'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED_BY_RATE_LIMIT'
  | 'LOGIN_BLOCKED_IP'
  | 'LOGIN_BLOCKED_MAINTENANCE'
  | 'UPDATE_MAINTENANCE_MODE'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'FILE_DELETE'
  | 'FILE_MOVE'
  | 'FILE_SHARE'
  | 'BULK_FILE_MOVE'
  | 'FOLDER_CREATE'
  | 'FOLDER_DELETE'
  | 'IMPERSONATION_START'
  | 'IMPERSONATION_END'
  | 'MODULE_VIEW'
  | 'DOCUMENT_GENERATE'

export type AuditActorKind = 'admin' | 'principal' | 'sub' | 'system' | 'anonymous'
export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type AuditCategory = 'admin' | 'users' | 'files' | 'auth' | 'data' | 'system'

export interface AuditLogInput {
  action_type: AuditActionType
  description: string
  target_type?: string | null
  target_id?: string | null
  target_label?: string | null
  metadata?: Record<string, unknown> | null
}

interface ActorOverride {
  actor_id?: string | null
  actor_email?: string | null
  actor_name?: string | null
  actor_role?: string | null
  actor_kind?: AuditActorKind | null
}

function resolveActorKind(
  role: string | null | undefined,
  parentUserId: string | null | undefined,
  actorId: string | null,
): AuditActorKind {
  if (!actorId) return 'anonymous'
  if (role === 'admin') return 'admin'
  if (role === 'user' && parentUserId) return 'sub'
  if (role === 'user') return 'principal'
  return 'system'
}

export async function logAudit(
  supabase: SupabaseClient,
  entry: AuditLogInput,
  actor?: ActorOverride,
): Promise<void> {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) console.error('[audit] auth error:', authError.message)

    let actor_id: string | null = actor?.actor_id ?? session?.user.id ?? null
    let actor_email: string | null = actor?.actor_email ?? session?.user.email ?? null
    let actor_name: string | null = actor?.actor_name ?? null
    let actor_role: string | null = actor?.actor_role ?? null
    let actor_kind: AuditActorKind | null = actor?.actor_kind ?? null

    if (actor_id && (!actor_name || !actor_role || !actor_kind)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, role, parent_user_id')
        .eq('id', actor_id)
        .single()
      actor_name = actor_name ?? profile?.full_name ?? null
      actor_email = profile?.email ?? actor_email
      actor_role = actor_role ?? profile?.role ?? null
      actor_kind = actor_kind ?? resolveActorKind(profile?.role, profile?.parent_user_id, actor_id)
    }

    if (!actor_id) {
      actor_kind = actor_kind ?? 'anonymous'
    }

    let safeTargetId = entry.target_id ?? null
    if (safeTargetId && typeof safeTargetId === 'string' && safeTargetId.includes(':')) {
      safeTargetId = safeTargetId.split(':')[0] ?? null
    }

    const payload = {
      actor_id,
      actor_email,
      actor_name,
      actor_role,
      actor_kind,
      action_type: entry.action_type,
      target_type: entry.target_type ?? null,
      target_id: safeTargetId,
      target_label: entry.target_label ?? null,
      description: entry.description,
      metadata: entry.metadata ?? { timestamp: new Date().toISOString() },
    }

    const { error: auditError } = await supabase.from('audit_logs').insert(payload)
    if (auditError) {
      console.error('[audit] insert failed:', auditError.message, auditError.code)
    }
  } catch (err) {
    console.error('[audit] unexpected failure:', err)
  }
}

export const ACTION_LABEL: Record<AuditActionType, string> = {
  CREATE_USER: 'Creación de usuario',
  UPDATE_USER: 'Actualización de usuario',
  BLOCK_USER: 'Bloqueo de usuario',
  UNBLOCK_USER: 'Desbloqueo de usuario',
  UPDATE_PERMISSION: 'Actualización de permiso',
  CREATE_MODULE: 'Creación de módulo',
  UPDATE_MODULE: 'Actualización de módulo',
  DELETE_MODULE: 'Eliminación de módulo',
  CREATE_DYNAMIC_TABLE: 'Creación de tabla dinámica',
  UPDATE_DYNAMIC_TABLE: 'Actualización de tabla dinámica',
  DELETE_DYNAMIC_TABLE: 'Eliminación de tabla dinámica',
  UPDATE_TABLE_COLUMNS: 'Actualización de columnas',
  CREATE_CHART: 'Creación de gráfico',
  UPDATE_CHART: 'Actualización de gráfico',
  DELETE_CHART: 'Eliminación de gráfico',
  IMPORT_EXCEL: 'Importación desde Excel',
  UPDATE_PASSWORD: 'Actualización de contraseña',
  UPDATE_DATA_ACCESS: 'Actualización de acceso a datos',
  RESTORE: 'Restauración',
  SYSTEM: 'Sistema',
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  LOGIN_FAILED: 'Inicio de sesión fallido',
  LOGIN_BLOCKED_BY_RATE_LIMIT: 'Login bloqueado (rate limit)',
  LOGIN_BLOCKED_IP: 'Login bloqueado (IP)',
  FILE_UPLOAD: 'Subida de archivo',
  FILE_DOWNLOAD: 'Descarga de archivo',
  FILE_DELETE: 'Eliminación de archivo',
  FILE_MOVE: 'Archivo movido',
  FILE_SHARE: 'Link compartido',
  BULK_FILE_MOVE: 'Movimiento masivo',
  FOLDER_CREATE: 'Carpeta creada',
  FOLDER_DELETE: 'Carpeta eliminada',
  IMPERSONATION_START: 'Modo soporte (inicio)',
  IMPERSONATION_END: 'Modo soporte (fin)',
  MODULE_VIEW: 'Visita a módulo',
  DOCUMENT_GENERATE: 'Documento generado',
}

const RISK_CRITICAL = new Set<AuditActionType>([
  'DELETE_MODULE', 'BLOCK_USER', 'UPDATE_PERMISSION', 'LOGIN_BLOCKED_IP',
])
const RISK_HIGH = new Set<AuditActionType>([
  'DELETE_CHART', 'DELETE_DYNAMIC_TABLE', 'FILE_DELETE', 'FOLDER_DELETE',
  'LOGIN_BLOCKED_BY_RATE_LIMIT', 'IMPERSONATION_START',
])
const RISK_MEDIUM = new Set<AuditActionType>([
  'CREATE_USER', 'UPDATE_USER', 'CREATE_MODULE', 'UPDATE_MODULE', 'UPDATE_PERMISSION',
  'UPDATE_DATA_ACCESS', 'UPDATE_PASSWORD', 'UPDATE_TABLE_COLUMNS', 'UPDATE_CHART',
  'CREATE_CHART', 'CREATE_DYNAMIC_TABLE', 'UPDATE_DYNAMIC_TABLE', 'IMPORT_EXCEL',
  'FILE_UPLOAD', 'FILE_MOVE', 'FILE_SHARE', 'BULK_FILE_MOVE', 'FOLDER_CREATE',
  'LOGIN_FAILED', 'SYSTEM',
])
const RISK_LOW = new Set<AuditActionType>([
  'LOGIN_SUCCESS', 'FILE_DOWNLOAD', 'RESTORE', 'UNBLOCK_USER', 'IMPERSONATION_END',
  'MODULE_VIEW', 'DOCUMENT_GENERATE',
])

export function getActionRiskLevel(action: string): AuditRiskLevel {
  const a = action as AuditActionType
  if (RISK_CRITICAL.has(a)) return 'critical'
  if (RISK_HIGH.has(a)) return 'high'
  if (RISK_MEDIUM.has(a)) return 'medium'
  return 'low'
}

export const RISK_LEVEL_ACTIONS: Record<AuditRiskLevel, AuditActionType[]> = {
  low:      [...RISK_LOW],
  medium:   [...RISK_MEDIUM],
  high:     [...RISK_HIGH],
  critical: [...RISK_CRITICAL],
}

export const CATEGORY_ACTIONS: Record<AuditCategory, AuditActionType[]> = {
  admin: [
    'CREATE_MODULE', 'UPDATE_MODULE', 'DELETE_MODULE', 'UPDATE_PERMISSION',
    'CREATE_USER', 'UPDATE_USER', 'BLOCK_USER', 'UNBLOCK_USER', 'UPDATE_PASSWORD',
    'UPDATE_DATA_ACCESS', 'RESTORE', 'SYSTEM',
    'IMPERSONATION_START', 'IMPERSONATION_END',
  ],
  users: [
    'CREATE_USER', 'UPDATE_USER', 'BLOCK_USER', 'UNBLOCK_USER', 'UPDATE_PERMISSION',
    'UPDATE_PASSWORD', 'UPDATE_DATA_ACCESS',
  ],
  files: [
    'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FILE_MOVE', 'FILE_SHARE',
    'BULK_FILE_MOVE', 'FOLDER_CREATE', 'FOLDER_DELETE',
  ],
  auth: [
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED_BY_RATE_LIMIT', 'LOGIN_BLOCKED_IP',
  ],
  data: [
    'CREATE_DYNAMIC_TABLE', 'UPDATE_DYNAMIC_TABLE', 'DELETE_DYNAMIC_TABLE', 'UPDATE_TABLE_COLUMNS',
    'CREATE_CHART', 'UPDATE_CHART', 'DELETE_CHART', 'IMPORT_EXCEL', 'DOCUMENT_GENERATE',
  ],
  system: ['SYSTEM', 'RESTORE', 'MODULE_VIEW'],
}

export function getActionCategory(action: string): AuditCategory {
  const a = action as AuditActionType
  for (const [cat, actions] of Object.entries(CATEGORY_ACTIONS) as [AuditCategory, AuditActionType[]][]) {
    if (actions.includes(a)) return cat
  }
  return 'system'
}

export const ACTOR_KIND_LABEL: Record<AuditActorKind, string> = {
  admin: 'Admin',
  principal: 'Cliente',
  sub: 'Subusuario',
  system: 'Sistema',
  anonymous: 'Anónimo',
}

export const RISK_LEVEL_LABEL: Record<AuditRiskLevel, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Crítico',
}

export function resolveRowActorKind(
  log: { actor_kind?: string | null; actor_id?: string | null; actor_role?: string | null; action_type?: string },
): AuditActorKind | null {
  if (log.actor_kind) return log.actor_kind as AuditActorKind
  if (!log.actor_id) return 'anonymous'
  if (log.actor_role === 'admin') return 'admin'
  if (log.action_type === 'SYSTEM') return 'system'
  return null
}

export function getActorKindBadgeClass(kind: AuditActorKind): string {
  switch (kind) {
    case 'admin':     return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
    case 'principal': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
    case 'sub':       return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30'
    case 'anonymous': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
    case 'system':    return 'bg-muted text-muted-foreground border border-border'
  }
}

export function getActionBadgeClass(action: AuditActionType | string): string {
  switch (action) {
    case 'CREATE_USER':
    case 'CREATE_MODULE':
    case 'FOLDER_CREATE':
    case 'FILE_UPLOAD':
    case 'LOGIN_SUCCESS':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
    case 'FILE_DOWNLOAD':
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
    case 'MODULE_VIEW':
      return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
    case 'DOCUMENT_GENERATE':
      return 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
    case 'FILE_SHARE':
      return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30'
    case 'UPDATE_PERMISSION':
    case 'UPDATE_MODULE':
    case 'UPDATE_USER':
    case 'FILE_MOVE':
    case 'BULK_FILE_MOVE':
      return 'bg-primary/15 text-primary border border-primary/30'
    case 'UNBLOCK_USER':
    case 'RESTORE':
      return 'bg-primary/15 text-primary border border-primary/30'
    case 'DELETE_MODULE':
    case 'BLOCK_USER':
    case 'FILE_DELETE':
    case 'FOLDER_DELETE':
    case 'LOGIN_BLOCKED_IP':
    case 'LOGIN_BLOCKED_BY_RATE_LIMIT':
      return 'bg-destructive/15 text-destructive border border-destructive/30'
    case 'LOGIN_FAILED':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
    case 'IMPERSONATION_START':
    case 'IMPERSONATION_END':
      return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30'
    case 'SYSTEM':
    default:
      return 'bg-muted text-muted-foreground border border-border'
  }
}

export function getRiskBadgeClass(level: AuditRiskLevel): string {
  switch (level) {
    case 'critical': return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
    case 'high':     return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
    case 'medium':   return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
    case 'low':      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
  }
}

export function isHighRiskEvent(action: string, actorKind?: string | null): boolean {
  const level = getActionRiskLevel(action)
  return level === 'high' || level === 'critical' || actorKind === 'anonymous'
}
