'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getViewAsContext } from '@/lib/impersonation'
import {
  formatAvailableStorage,
  formatQuotaLimit,
  resolveStorageQuotaBytes,
} from '@/lib/vault-storage'
import {
  inferVaultUploadFileType,
  isAllowedVaultUpload,
  resolveVaultUploadContentType,
  VAULT_MAX_UPLOAD_BYTES,
} from '@/lib/vault-upload'

export interface VaultStorageInfo {
  usedBytes: number
  quotaBytes: number
  quotaLabel: string
}

export interface VaultDocumentFile {
  id: string
  name: string
  size: number
  type: string
  folderId: string | null
  storagePath: string
  createdAt: string
  expiresAt: string | null
}

export interface VaultDocumentFolder {
  id: string
  name: string
  parentId: string | null
}

export interface VaultDataPayload {
  ownerId: string
  folders: VaultDocumentFolder[]
  files: VaultDocumentFile[]
  storage: {
    usedBytes: number
    quotaBytes: number
    quotaLabel: string
  }
}

function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function resolveActingUserId(sessionUserId: string): Promise<string> {
  const viewAs = await getViewAsContext()
  return viewAs.viewAsUserId ?? sessionUserId
}

async function resolveVaultOwnerId(
  client: NonNullable<ReturnType<typeof getServiceClient>>,
  userId: string,
): Promise<string> {
  const { data } = await client
    .from('profiles')
    .select('parent_user_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (data?.role === 'user' && data.parent_user_id) {
    return String(data.parent_user_id)
  }
  return userId
}

async function getVaultOwnerUserIds(
  client: NonNullable<ReturnType<typeof getServiceClient>>,
  ownerId: string,
): Promise<string[]> {
  const { data: subs } = await client
    .from('profiles')
    .select('id')
    .eq('parent_user_id', ownerId)

  return [ownerId, ...(subs?.map(s => String(s.id)) ?? [])]
}

function mapFolder(row: Record<string, unknown>): VaultDocumentFolder {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    parentId:
      row.parent_id === null || row.parent_id === undefined || row.parent_id === ''
        ? null
        : String(row.parent_id),
  }
}

function mapFile(row: Record<string, unknown>): VaultDocumentFile {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    size: Number(row.size) || 0,
    type: String(row.type ?? 'pdf'),
    folderId:
      row.folder_id === null || row.folder_id === undefined || row.folder_id === ''
        ? null
        : String(row.folder_id),
    storagePath: String(row.storage_path ?? ''),
    createdAt: String(row.created_at ?? ''),
    expiresAt: row.expires_at != null ? String(row.expires_at) : null,
  }
}

async function fetchVaultViaService(actingUserId: string): Promise<VaultDataPayload | null> {
  const service = getServiceClient()
  if (!service) return null

  const ownerId = await resolveVaultOwnerId(service, actingUserId)
  const ownerIds = await getVaultOwnerUserIds(service, ownerId)

  const [foldersRes, docsRes, quotaRes] = await Promise.all([
    service
      .from('carpetas')
      .select('*')
      .in('user_id', ownerIds)
      .order('created_at', { ascending: false }),
    service
      .from('documentos')
      .select('*')
      .in('user_id', ownerIds)
      .order('created_at', { ascending: false }),
    service
      .from('profiles')
      .select('storage_quota_gb, storage_quota_bytes')
      .eq('id', ownerId)
      .maybeSingle(),
  ])

  if (foldersRes.error) {
    console.error('[vault] carpetas query failed:', foldersRes.error.message)
  }
  if (docsRes.error) {
    console.error('[vault] documentos query failed:', docsRes.error.message)
  }

  const folders = (foldersRes.data ?? []).map(row => mapFolder(row as Record<string, unknown>))
  const files = (docsRes.data ?? []).map(row => mapFile(row as Record<string, unknown>))

  const usedBytes = files.reduce((sum, file) => sum + file.size, 0)
  const quotaBytes = resolveStorageQuotaBytes({
    storage_quota_bytes: quotaRes.data?.storage_quota_bytes,
    storage_quota_gb: quotaRes.data?.storage_quota_gb,
  })

  return {
    ownerId,
    folders,
    files,
    storage: {
      usedBytes,
      quotaBytes,
      quotaLabel: formatQuotaLimit(quotaBytes),
    },
  }
}

export async function getMyVaultDataAction(): Promise<VaultDataPayload | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const actingUserId = await resolveActingUserId(user.id)
  return fetchVaultViaService(actingUserId)
}

async function resolveVaultSessionUserId(sessionUserId: string): Promise<string> {
  return resolveActingUserId(sessionUserId)
}

export async function checkVaultUploadAllowedAction(fileSize: number): Promise<{
  ok: boolean
  message?: string
  storage?: VaultDataPayload['storage']
}> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: 'Debes iniciar sesión para subir archivos.' }
  }

  const actingUserId = await resolveVaultSessionUserId(user.id)
  const data = await fetchVaultViaService(actingUserId)
  if (!data) {
    return { ok: false, message: 'No se pudo validar el almacenamiento.' }
  }

  if (fileSize <= 0) {
    return { ok: false, message: 'Archivo inválido.' }
  }

  if (data.storage.usedBytes + fileSize > data.storage.quotaBytes) {
    return {
      ok: false,
      message: `No hay espacio suficiente. Tu plan permite ${data.storage.quotaLabel} y te quedan ${formatAvailableStorage(data.storage.usedBytes, data.storage.quotaBytes)} disponibles.`,
      storage: data.storage,
    }
  }

  return { ok: true, storage: data.storage }
}

export async function uploadVaultDocumentAction(formData: FormData): Promise<{
  ok: boolean
  message?: string
  file?: VaultDocumentFile
  storage?: VaultDataPayload['storage']
}> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: 'Debes iniciar sesión para subir archivos.' }
  }

  const service = getServiceClient()
  if (!service) {
    return { ok: false, message: 'No se pudo conectar con el almacenamiento.' }
  }

  const fileEntry = formData.get('file')
  if (!(fileEntry instanceof File)) {
    return { ok: false, message: 'Archivo inválido.' }
  }

  const folderIdRaw = formData.get('folderId')
  const folderId =
    folderIdRaw === null || folderIdRaw === undefined || String(folderIdRaw) === ''
      ? null
      : String(folderIdRaw)
  const expiresAtRaw = formData.get('expiresAt')
  const expiresAt =
    expiresAtRaw === null || expiresAtRaw === undefined || String(expiresAtRaw) === ''
      ? null
      : String(expiresAtRaw)

  if (!isAllowedVaultUpload(fileEntry)) {
    return { ok: false, message: 'Tipo de archivo no soportado. Solo PDF, JPG, PNG, Excel, CSV y Word.' }
  }

  if (fileEntry.size > VAULT_MAX_UPLOAD_BYTES) {
    return { ok: false, message: 'Archivo muy grande. Máximo 10 MB.' }
  }

  const quotaCheck = await checkVaultUploadAllowedAction(fileEntry.size)
  if (!quotaCheck.ok) {
    return { ok: false, message: quotaCheck.message, storage: quotaCheck.storage }
  }

  const actingUserId = await resolveVaultSessionUserId(user.id)
  const ownerId = await resolveVaultOwnerId(service, actingUserId)
  const type = inferVaultUploadFileType(fileEntry)
  const folderPath = folderId || 'root'
  const storagePath = `${ownerId}/${folderPath}/${Date.now()}_${fileEntry.name}`
  const contentType = resolveVaultUploadContentType(fileEntry)

  const { error: uploadError } = await service.storage
    .from('boveda')
    .upload(storagePath, fileEntry, {
      contentType,
      upsert: false,
    })

  if (uploadError) {
    console.error('[vault] storage upload failed:', uploadError.message)
    return { ok: false, message: `Error al subir archivo: ${uploadError.message}` }
  }

  const insertPayload: Record<string, unknown> = {
    name: fileEntry.name,
    size: fileEntry.size,
    type,
    storage_path: storagePath,
    folder_id: folderId,
    user_id: ownerId,
  }
  if (expiresAt) insertPayload.expires_at = expiresAt

  const { data: inserted, error: insertError } = await service
    .from('documentos')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertError) {
    console.error('[vault] documentos insert failed:', insertError.message)
    await service.storage.from('boveda').remove([storagePath])
    if (insertError.message.includes('storage_quota_exceeded')) {
      return {
        ok: false,
        message: `Has alcanzado el límite de almacenamiento de tu plan (${quotaCheck.storage?.quotaLabel ?? '10 GB'}).`,
        storage: quotaCheck.storage,
      }
    }
    return { ok: false, message: `Error al guardar metadata: ${insertError.message}` }
  }

  const usedBytes = (quotaCheck.storage?.usedBytes ?? 0) + fileEntry.size
  const quotaBytes = quotaCheck.storage?.quotaBytes ?? 0

  return {
    ok: true,
    file: mapFile(inserted as Record<string, unknown>),
    storage: {
      usedBytes,
      quotaBytes,
      quotaLabel: formatQuotaLimit(quotaBytes),
    },
  }
}
