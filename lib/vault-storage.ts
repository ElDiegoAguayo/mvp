export const STORAGE_PLAN_1MB_TEST_BYTES = 1024 * 1024

/** Planes disponibles. `1mb-test` es temporal para validar el límite. */
export const STORAGE_PLANS = [
  { id: '1mb-test', label: '1 MB (prueba)', quotaBytes: STORAGE_PLAN_1MB_TEST_BYTES },
  { id: '10gb', label: '10 GB', quotaBytes: 10 * 1024 * 1024 * 1024 },
  { id: '25gb', label: '25 GB', quotaBytes: 25 * 1024 * 1024 * 1024 },
  { id: '50gb', label: '50 GB', quotaBytes: 50 * 1024 * 1024 * 1024 },
  { id: '100gb', label: '100 GB', quotaBytes: 100 * 1024 * 1024 * 1024 },
] as const

export type StoragePlanId = (typeof STORAGE_PLANS)[number]['id']

export const DEFAULT_STORAGE_QUOTA_GB = 10

export function getStoragePlanById(planId: string) {
  return STORAGE_PLANS.find(plan => plan.id === planId) ?? null
}

export function isStoragePlanId(planId: string): planId is StoragePlanId {
  return STORAGE_PLANS.some(plan => plan.id === planId)
}

export function gbToBytes(gb: number): number {
  return Math.round(gb * 1024 * 1024 * 1024)
}

export function bytesToGb(bytes: number): number {
  return bytes / (1024 * 1024 * 1024)
}

export function resolveStorageQuotaBytes(input: {
  storage_quota_bytes?: number | null
  storage_quota_gb?: number | null
}): number {
  const override = Number(input.storage_quota_bytes)
  if (Number.isFinite(override) && override > 0) return override
  const gb = Number(input.storage_quota_gb) || DEFAULT_STORAGE_QUOTA_GB
  return gbToBytes(gb)
}

export function resolveStoragePlanId(input: {
  storage_quota_bytes?: number | null
  storage_quota_gb?: number | null
}): StoragePlanId {
  const bytesOverride = Number(input.storage_quota_bytes)
  if (Number.isFinite(bytesOverride) && bytesOverride > 0) {
    const byBytes = STORAGE_PLANS.find(plan => plan.quotaBytes === bytesOverride)
    if (byBytes) return byBytes.id
  }

  const quotaBytes = resolveStorageQuotaBytes(input)
  const match = STORAGE_PLANS.find(plan => plan.quotaBytes === quotaBytes)
  if (match) return match.id
  return '10gb'
}

export function formatQuotaLimit(quotaBytes: number): string {
  if (quotaBytes < 1024 * 1024 * 1024) {
    return formatStorageBytes(quotaBytes)
  }
  const gb = Math.round(bytesToGb(quotaBytes))
  return `${gb} GB`
}

export function storageUsagePercent(usedBytes: number, quotaBytes: number): number {
  if (quotaBytes <= 0) return 0
  const raw = (usedBytes / quotaBytes) * 100
  if (usedBytes > 0 && raw > 0 && raw < 1) {
    return Math.max(0.1, Math.round(raw * 10) / 10)
  }
  return Math.min(100, Math.round(raw))
}

/** Etiqueta de porcentaje usado con decimales cuando el uso es bajo. */
export function formatStorageUsageLabel(usedBytes: number, quotaBytes: number): string {
  if (quotaBytes <= 0 || usedBytes <= 0) return '0% usado'
  const pct = (usedBytes / quotaBytes) * 100
  if (pct < 0.01) return '<0.01% usado'
  if (pct < 1) return `${pct.toFixed(2)}% usado`
  if (pct < 10) return `${pct.toFixed(1)}% usado`
  return `${Math.round(pct)}% usado`
}

/** Espacio restante con precisión acorde al plan (evita "10.00 GB" cuando ya hay uso). */
export function formatAvailableStorage(usedBytes: number, quotaBytes: number): string {
  const available = Math.max(0, quotaBytes - usedBytes)
  if (available === 0) return '0 B'

  const GB = 1024 * 1024 * 1024

  if (quotaBytes >= GB && available >= GB) {
    const availableGb = available / GB
    const hasMeaningfulUsage = usedBytes > 0 && usedBytes / quotaBytes < 0.05
    const decimals = hasMeaningfulUsage && availableGb >= 1 ? 3 : 2
    const factor = 10 ** decimals
    const floored = Math.floor(availableGb * factor) / factor
    return `${floored.toFixed(decimals)} GB`
  }

  return formatStorageBytes(available)
}

export function formatStorageBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatStorageSummary(usedBytes: number, quotaBytes: number): string {
  const pct = storageUsagePercent(usedBytes, quotaBytes)
  return `${formatStorageBytes(usedBytes)} de ${formatQuotaLimit(quotaBytes)} (${pct}%)`
}

export function storageBarTone(percent: number): 'ok' | 'warning' | 'critical' {
  if (percent >= 90) return 'critical'
  if (percent >= 75) return 'warning'
  return 'ok'
}

/** @deprecated Usar STORAGE_PLANS */
export const STORAGE_PLAN_OPTIONS_GB = [10, 25, 50, 100] as const
