'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { getViewAsContext } from '@/lib/impersonation'
import { formatAvailableStorage } from '@/lib/vault-storage'
import { fetchClientStorageForUser } from '@/lib/client-storage-server'
import type { ClientStorageInfo } from '@/lib/client-storage'

export type { ClientStorageInfo }

async function resolveActingUserId(sessionUserId: string): Promise<string> {
  const viewAs = await getViewAsContext()
  return viewAs.viewAsUserId ?? sessionUserId
}

export async function getMyClientStorageAction(): Promise<ClientStorageInfo | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const actingUserId = await resolveActingUserId(user.id)
  return fetchClientStorageForUser(actingUserId)
}

export async function checkClientStorageAllowedAction(fileSize: number): Promise<{
  ok: boolean
  message?: string
  storage?: ClientStorageInfo
}> {
  const storage = await getMyClientStorageAction()
  if (!storage) {
    return { ok: false, message: 'No se pudo validar el almacenamiento.' }
  }

  if (fileSize <= 0) {
    return { ok: false, message: 'Archivo inválido.' }
  }

  if (storage.usedBytes + fileSize > storage.quotaBytes) {
    return {
      ok: false,
      message: `No hay espacio suficiente. Tu plan permite ${storage.quotaLabel} y te quedan ${formatAvailableStorage(storage.usedBytes, storage.quotaBytes)} disponibles.`,
      storage,
    }
  }

  return { ok: true, storage }
}
