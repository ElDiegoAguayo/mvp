import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalizedText } from '@/lib/i18n/localized-text'

export const ADMIN_NOTIFICATION_SELECT_BASE =
  'id, title, message, severity, active_from, active_until, created_at, target_role' as const

export const ADMIN_NOTIFICATION_SELECT_I18N =
  `${ADMIN_NOTIFICATION_SELECT_BASE}, title_i18n, message_i18n` as const

export function isMissingI18nColumnError(message: string | undefined): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('title_i18n') ||
    lower.includes('message_i18n') ||
    lower.includes('schema cache')
  )
}

type AdminNotifClient = SupabaseClient

export type AdminNotificationInsert = {
  title: string
  message: string
  title_i18n: LocalizedText
  message_i18n: LocalizedText
  severity: string
  active_from: string
  active_until: string
  created_by: string
  target_role: string
}

export type AdminNotificationUpdate = Omit<AdminNotificationInsert, 'created_by'>

export async function listAdminNotifications(
  client: AdminNotifClient,
): Promise<{ data: Record<string, unknown>[] | null; error: Error | null }> {
  const withI18n = await client
    .from('admin_notifications')
    .select(ADMIN_NOTIFICATION_SELECT_I18N)
    .order('created_at', { ascending: false })

  if (!isMissingI18nColumnError(withI18n.error?.message)) {
    return {
      data: withI18n.data as Record<string, unknown>[] | null,
      error: withI18n.error ? new Error(withI18n.error.message) : null,
    }
  }

  const base = await client
    .from('admin_notifications')
    .select(ADMIN_NOTIFICATION_SELECT_BASE)
    .order('created_at', { ascending: false })

  return {
    data: base.data as Record<string, unknown>[] | null,
    error: base.error ? new Error(base.error.message) : null,
  }
}

export async function insertAdminNotification(
  client: AdminNotifClient,
  row: AdminNotificationInsert,
): Promise<{ error: Error | null; i18nApplied: boolean }> {
  const withI18n = await client.from('admin_notifications').insert(row)

  if (!isMissingI18nColumnError(withI18n.error?.message)) {
    return {
      error: withI18n.error ? new Error(withI18n.error.message) : null,
      i18nApplied: true,
    }
  }

  const { title_i18n: _t, message_i18n: _m, ...base } = row
  const baseInsert = await client.from('admin_notifications').insert(base)
  return {
    error: baseInsert.error ? new Error(baseInsert.error.message) : null,
    i18nApplied: false,
  }
}

export async function updateAdminNotification(
  client: AdminNotifClient,
  id: string,
  row: AdminNotificationUpdate,
): Promise<{ error: Error | null; i18nApplied: boolean }> {
  const withI18n = await client.from('admin_notifications').update(row).eq('id', id)

  if (!isMissingI18nColumnError(withI18n.error?.message)) {
    return {
      error: withI18n.error ? new Error(withI18n.error.message) : null,
      i18nApplied: true,
    }
  }

  const { title_i18n: _t, message_i18n: _m, ...base } = row
  const baseUpdate = await client.from('admin_notifications').update(base).eq('id', id)
  return {
    error: baseUpdate.error ? new Error(baseUpdate.error.message) : null,
    i18nApplied: false,
  }
}

export type { LocalizedText }
