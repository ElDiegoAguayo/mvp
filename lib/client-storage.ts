import {
  formatQuotaLimit,
  formatStorageBytes,
  resolveStorageQuotaBytes,
} from '@/lib/vault-storage'

export interface ClientStorageModule {
  id: string
  label: string
  bytes: number
  files: number
}

export interface ClientStorageInfo {
  usedBytes: number
  quotaBytes: number
  quotaLabel: string
  modules: ClientStorageModule[]
}

export const CLIENT_STORAGE_MODULE_LABELS: Record<string, string> = {
  boveda: 'Mis documentos',
  fenologia: 'Estados fenológicos',
}

export function parseClientStorageRpc(raw: unknown): ClientStorageInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const usedBytes = Number(data.used_bytes) || 0
  const quotaBytes = Number(data.quota_bytes) || 0
  const modulesRaw = Array.isArray(data.modules) ? data.modules : []

  const modules: ClientStorageModule[] = modulesRaw.map((m) => {
    const row = m as Record<string, unknown>
    const id = String(row.id ?? '')
    return {
      id,
      label: String(row.label ?? CLIENT_STORAGE_MODULE_LABELS[id] ?? id),
      bytes: Number(row.bytes) || 0,
      files: Number(row.files) || 0,
    }
  })

  return {
    usedBytes,
    quotaBytes,
    quotaLabel: formatQuotaLimit(quotaBytes),
    modules,
  }
}

export function formatModuleStorageLine(mod: ClientStorageModule): string {
  const filesLabel = mod.files === 1 ? '1 archivo' : `${mod.files} archivos`
  return `${formatStorageBytes(mod.bytes)} · ${filesLabel}`
}

export { formatStorageBytes, resolveStorageQuotaBytes }