export const DEFAULT_MAINTENANCE_MESSAGE =
  'La plataforma está en mantenimiento programado. Estaremos de vuelta pronto. Gracias por tu paciencia.'

export interface MaintenancePreset {
  id: string
  label: string
  message: string
}

export const MAINTENANCE_PRESETS: MaintenancePreset[] = [
  {
    id: 'scheduled',
    label: 'Mantenimiento programado',
    message:
      'Estamos realizando un mantenimiento programado. La plataforma volverá a estar disponible en breve. Gracias por tu paciencia.',
  },
  {
    id: 'update',
    label: 'Actualización en curso',
    message:
      'Estamos instalando una actualización importante. El acceso estará disponible nuevamente cuando terminemos. Disculpa las molestias.',
  },
  {
    id: 'database',
    label: 'Mantenimiento de base de datos',
    message:
      'Estamos optimizando la base de datos. Por favor, intenta iniciar sesión más tarde. Tus datos están seguros.',
  },
  {
    id: 'emergency',
    label: 'Mantenimiento de emergencia',
    message:
      'Detectamos un problema técnico y estamos trabajando para resolverlo. El acceso a clientes está temporalmente suspendido.',
  },
]

export interface SavedMaintenancePreset {
  id: string
  label: string
  message: string
  createdAt?: string
}

export function parseCustomPresets(raw: unknown): SavedMaintenancePreset[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const id = String(row.id ?? '').trim()
      const label = String(row.label ?? '').trim()
      const message = String(row.message ?? '').trim()
      if (!id || !label || !message) return null
      return {
        id,
        label,
        message,
        createdAt: row.created_at ? String(row.created_at) : undefined,
      }
    })
    .filter((p): p is SavedMaintenancePreset => p !== null)
}

export interface PlatformMaintenanceState {
  enabled: boolean
  message: string
  updatedAt: string | null
  updatedByEmail: string | null
  customPresets: SavedMaintenancePreset[]
}

export function allMaintenancePresets(custom: SavedMaintenancePreset[]): MaintenancePreset[] {
  return [
    ...MAINTENANCE_PRESETS,
    ...custom.map((p) => ({ id: `saved-${p.id}`, label: p.label, message: p.message })),
  ]
}
