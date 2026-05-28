import { inferVaultFileType } from '@/lib/vault-preview'

export const VAULT_ALLOWED_EXTENSIONS = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'xlsx', 'xls', 'csv', 'doc', 'docx',
])

const VAULT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'text/comma-separated-values',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export function isAllowedVaultUpload(file: { name: string; type?: string }): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (VAULT_ALLOWED_EXTENSIONS.has(ext)) return true
  return Boolean(file.type && VAULT_ALLOWED_MIME_TYPES.has(file.type))
}

export function resolveVaultUploadContentType(file: { name: string; type?: string }): string | undefined {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'csv') return 'text/csv'
  return file.type || undefined
}

export function inferVaultUploadFileType(file: { name: string; type?: string }) {
  return inferVaultFileType(file.name, file.type)
}

export const VAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
