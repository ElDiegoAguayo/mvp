'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { logAudit, type AuditActionType } from '@/lib/audit-log'

export type RestoreState = {
  ok: boolean
  message: string
}

interface AuditLogRow {
  id: string
  action_type: AuditActionType
  target_type: string | null
  target_id: string | null
  target_label: string | null
  description: string
  metadata: Record<string, any> | null
}

/**
 * Restore the previous_state captured in an audit log entry.
 * - DELETE_MODULE     -> re-create the module + all its access rows
 * - BLOCK_USER        -> set is_active back to previous value
 * - UNBLOCK_USER      -> set is_active back to previous value
 * - UPDATE_PERMISSION -> upsert user_module_access.enabled to previous value
 */
export async function restoreAuditAction(
  logId: string,
): Promise<RestoreState> {
  if (!logId) return { ok: false, message: 'ID de evento inválido.' }

  const supabase = await createServerClient()

  // 1. Verify caller is admin
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) {
    return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { ok: false, message: 'Solo administradores pueden restaurar.' }
  }

  // 2. Use service-role client to bypass RLS for module restore
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      message: 'Configuración del servidor incompleta (SUPABASE_SERVICE_ROLE_KEY).',
    }
  }
  const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 3. Load the audit log entry
  const { data: log, error: logErr } = await adminClient
    .from('audit_logs')
    .select('id, action_type, target_type, target_id, target_label, description, metadata')
    .eq('id', logId)
    .single()

  if (logErr || !log) {
    return { ok: false, message: 'No se encontró el evento.' }
  }

  const row = log as AuditLogRow
  const prev = row.metadata?.previous_state

  if (!prev) {
    return {
      ok: false,
      message: 'Este evento no tiene un estado previo para restaurar.',
    }
  }

  let restoreDescription = ''

  try {
    switch (row.action_type) {
      case 'DELETE_MODULE': {
        const mod = prev.module
        const access: Array<{ user_id: string; module_id: string; enabled: boolean }> =
          prev.access ?? []
        if (!mod?.id) {
          return { ok: false, message: 'Snapshot de módulo incompleto.' }
        }
        // Re-insert the module
        const { error: insertErr } = await adminClient.from('modules').insert(mod)
        if (insertErr) {
          return {
            ok: false,
            message: `No se pudo restaurar el módulo: ${insertErr.message}`,
          }
        }
        // Re-insert access rows (best-effort)
        if (access.length > 0) {
          await adminClient
            .from('user_module_access')
            .upsert(
              access.map((a) => ({
                user_id: a.user_id,
                module_id: a.module_id,
                enabled: a.enabled,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: 'user_id,module_id' },
            )
        }
        restoreDescription = `Restauró el módulo "${mod.name}" eliminado previamente.`
        break
      }

      case 'BLOCK_USER':
      case 'UNBLOCK_USER': {
        if (!prev.user_id || typeof prev.is_active !== 'boolean') {
          return { ok: false, message: 'Snapshot de usuario incompleto.' }
        }
        const { error: updErr } = await adminClient
          .from('profiles')
          .update({
            is_active: prev.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prev.user_id)
        if (updErr) {
          return {
            ok: false,
            message: `No se pudo restaurar el estado: ${updErr.message}`,
          }
        }
        restoreDescription = `Restauró el estado anterior (${
          prev.is_active ? 'activo' : 'bloqueado'
        }) para ${row.target_label ?? 'usuario'}.`
        break
      }

      case 'UPDATE_PERMISSION': {
        if (!prev.user_id || !prev.module_id || typeof prev.enabled !== 'boolean') {
          return { ok: false, message: 'Snapshot de permiso incompleto.' }
        }
        const { error: upErr } = await adminClient
          .from('user_module_access')
          .upsert(
            {
              user_id: prev.user_id,
              module_id: prev.module_id,
              enabled: prev.enabled,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,module_id' },
          )
        if (upErr) {
          return {
            ok: false,
            message: `No se pudo restaurar el permiso: ${upErr.message}`,
          }
        }
        restoreDescription = `Restauró el permiso anterior (${
          prev.enabled ? 'activo' : 'inactivo'
        }) para ${row.target_label ?? 'usuario'}.`
        break
      }

      default:
        return {
          ok: false,
          message: 'Este tipo de evento no es restaurable.',
        }
    }

    // 4. Log the restoration itself
    await logAudit(
      adminClient,
      {
        action_type: 'RESTORE',
        target_type: row.target_type,
        target_id: row.target_id,
        target_label: row.target_label,
        description: restoreDescription,
        metadata: {
          restored_from_log_id: row.id,
          original_action: row.action_type,
        },
      },
      {
        actor_id: caller.id,
        actor_email: callerProfile?.email ?? caller.email ?? null,
        actor_name: callerProfile?.full_name ?? null,
      },
    )

    revalidatePath('/admin')
    revalidatePath('/admin/auditoria')

    return { ok: true, message: restoreDescription }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error inesperado al restaurar.'
    return { ok: false, message }
  }
}
